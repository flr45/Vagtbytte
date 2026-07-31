#!/usr/bin/env python3
"""Forward new SMS messages from Gammu to SBR Portal Alarmfeed.

Required environment variables:
  SBR_PORTAL_URL=https://example.com
  ALARM_FEED_INGEST_TOKEN=secret

Optional:
  GAMMU_CONFIG=/etc/gammurc
  SMS_POLL_SECONDS=10
  SMS_STATE_FILE=/var/lib/sbr-alarm-feed/state.json
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

LOG = logging.getLogger("sbr-alarm-sms-worker")


@dataclass(frozen=True)
class SmsMessage:
    location: int
    folder: str
    sender: str
    text: str
    timestamp: str

    @property
    def source_message_id(self) -> str:
        payload = f"{self.folder}:{self.location}:{self.sender}:{self.timestamp}:{self.text}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Miljøvariablen {name} mangler")
    return value


def load_state(path: Path) -> set[str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return set(data.get("forwarded", []))
    except FileNotFoundError:
        return set()
    except (OSError, json.JSONDecodeError) as exc:
        LOG.warning("Kunne ikke læse state-fil %s: %s", path, exc)
        return set()


def save_state(path: Path, forwarded: set[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps({"forwarded": sorted(forwarded)[-5000:]}), encoding="utf-8")
    temporary.replace(path)


def run_gammu(config: str | None) -> str:
    command = ["gammu"]
    if config:
        command.extend(["--config", config])
    command.append("getallsms")
    completed = subprocess.run(command, check=True, capture_output=True, text=True, timeout=60)
    return completed.stdout


def parse_gammu_datetime(value: str) -> str:
    value = value.strip()
    for pattern in ("%a %d %b %Y %H:%M:%S %z", "%Y-%m-%d %H:%M:%S %z"):
        try:
            return datetime.strptime(value, pattern).astimezone(timezone.utc).isoformat()
        except ValueError:
            pass
    return datetime.now(timezone.utc).isoformat()


def parse_messages(output: str) -> list[SmsMessage]:
    locations = list(re.finditer(r'^Location\s*:\s*(\d+),\s*folder\s+"([^"]+)".*$', output, re.MULTILINE))
    messages: list[SmsMessage] = []

    for index, match in enumerate(locations):
        start = match.start()
        end = locations[index + 1].start() if index + 1 < len(locations) else len(output)
        block = output[start:end]
        sender_match = re.search(r'^Remote number\s*:\s*"([^"]+)"\s*$', block, re.MULTILINE)
        sent_match = re.search(r'^Sent\s*:\s*(.+)$', block, re.MULTILINE)
        if not sender_match:
            continue

        lines = block.splitlines()
        text_start = None
        for line_index, line in enumerate(lines):
            if line.startswith("User Data Header") or line.startswith("Status"):
                continue
            if line_index > 0 and line.strip() == "" and any(
                previous.startswith("Remote number") or previous.startswith("Status")
                for previous in lines[max(0, line_index - 3):line_index]
            ):
                text_start = line_index + 1
                break

        if text_start is None:
            # Gammu normally places the body after the final metadata line and a blank line.
            metadata_end = 0
            for line_index, line in enumerate(lines):
                if re.match(r"^(Location|SMSC number|Sent|Coding|Remote number|Status|User Data Header)\s*:", line):
                    metadata_end = line_index + 1
            text_start = metadata_end

        body_lines = lines[text_start:]
        while body_lines and not body_lines[0].strip():
            body_lines.pop(0)
        while body_lines and (not body_lines[-1].strip() or body_lines[-1].startswith("SMS parts")):
            body_lines.pop()
        text = "\n".join(body_lines).strip()
        if not text:
            continue

        messages.append(
            SmsMessage(
                location=int(match.group(1)),
                folder=match.group(2),
                sender=sender_match.group(1).strip(),
                text=text,
                timestamp=parse_gammu_datetime(sent_match.group(1)) if sent_match else datetime.now(timezone.utc).isoformat(),
            )
        )
    return messages


def post_message(base_url: str, token: str, message: SmsMessage) -> None:
    endpoint = f"{base_url.rstrip('/')}/api/alarm-feed/ingest"
    body = json.dumps(
        {
            "senderNumber": message.sender,
            "rawMessage": message.text,
            "receivedAt": message.timestamp,
            "sourceMessageId": message.source_message_id,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "SBR-Alarm-SMS-Worker/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status not in (200, 201):
            raise RuntimeError(f"Portal returnerede HTTP {response.status}")


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    portal_url = env_required("SBR_PORTAL_URL")
    token = env_required("ALARM_FEED_INGEST_TOKEN")
    config = os.getenv("GAMMU_CONFIG") or None
    poll_seconds = max(5, int(os.getenv("SMS_POLL_SECONDS", "10")))
    state_path = Path(os.getenv("SMS_STATE_FILE", "/var/lib/sbr-alarm-feed/state.json"))
    forwarded = load_state(state_path)

    LOG.info("SMS-worker startet; polling hvert %s sekund", poll_seconds)
    while True:
        try:
            for message in parse_messages(run_gammu(config)):
                if message.source_message_id in forwarded:
                    continue
                post_message(portal_url, token, message)
                forwarded.add(message.source_message_id)
                save_state(state_path, forwarded)
                LOG.info("Videresendte SMS fra %s", message.sender)
        except subprocess.CalledProcessError as exc:
            LOG.error("Gammu-kommando fejlede: %s", exc.stderr or exc)
        except urllib.error.HTTPError as exc:
            LOG.error("Portal afviste besked med HTTP %s", exc.code)
        except (urllib.error.URLError, TimeoutError) as exc:
            LOG.error("Kunne ikke kontakte portalen: %s", exc)
        except Exception:
            LOG.exception("Uventet fejl i SMS-worker")
        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
