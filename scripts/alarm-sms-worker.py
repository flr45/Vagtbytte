#!/usr/bin/env python3
"""Forward new SMS messages from Gammu to SBR Portal Alarmfeed.

Required environment variables:
  SBR_PORTAL_URL=https://example.com
  ALARM_FEED_INGEST_TOKEN=secret

Recommended:
  ALARM_ALLOWED_SENDERS=+4512345678,+4587654321

Optional:
  GAMMU_CONFIG=/etc/gammurc
  SMS_POLL_SECONDS=10
  SMS_STATE_FILE=/var/lib/sbr-alarm-feed/state.json
  LOG_LEVEL=INFO

Commands:
  python3 scripts/alarm-sms-worker.py          # continuous worker
  python3 scripts/alarm-sms-worker.py --once   # one polling cycle
  python3 scripts/alarm-sms-worker.py --dry-run --once
"""

from __future__ import annotations

import argparse
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


def normalize_phone_number(value: str) -> str:
    return re.sub(r"[\s()\-]", "", value.strip())


def configured_allowed_senders() -> set[str]:
    raw = os.getenv("ALARM_ALLOWED_SENDERS", "")
    return {normalize_phone_number(value) for value in raw.split(",") if value.strip()}


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
    patterns = (
        "%a %d %b %Y %H:%M:%S %z",
        "%a %d %b %Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S",
    )
    for pattern in patterns:
        try:
            parsed = datetime.strptime(value, pattern)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except ValueError:
            pass
    LOG.warning("Kunne ikke fortolke SMS-tidspunktet %r; bruger modtagelsestidspunktet", value)
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
        metadata_end = 0
        for line_index, line in enumerate(lines):
            if re.match(r"^(Location|SMSC number|Sent|Coding|Remote number|Status|User Data Header)\s*:", line):
                metadata_end = line_index + 1

        body_lines = lines[metadata_end:]
        while body_lines and not body_lines[0].strip():
            body_lines.pop(0)
        while body_lines and (
            not body_lines[-1].strip()
            or body_lines[-1].startswith("SMS parts")
            or body_lines[-1].startswith("Decoded ")
        ):
            body_lines.pop()

        text = "\n".join(body_lines).strip()
        if not text:
            continue

        messages.append(
            SmsMessage(
                location=int(match.group(1)),
                folder=match.group(2),
                sender=normalize_phone_number(sender_match.group(1)),
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


def process_once(
    portal_url: str,
    token: str,
    config: str | None,
    state_path: Path,
    forwarded: set[str],
    allowed_senders: set[str],
    dry_run: bool,
) -> int:
    processed = 0
    for message in parse_messages(run_gammu(config)):
        if allowed_senders and message.sender not in allowed_senders:
            LOG.warning("Ignorerede SMS fra ikke-godkendt afsender %s", message.sender)
            continue
        if message.source_message_id in forwarded:
            continue
        if dry_run:
            LOG.info("DRY RUN: ville videresende SMS fra %s: %s", message.sender, message.text)
        else:
            post_message(portal_url, token, message)
            forwarded.add(message.source_message_id)
            save_state(state_path, forwarded)
            LOG.info("Videresendte SMS fra %s", message.sender)
        processed += 1
    return processed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Videresend alarm-SMS fra Gammu til SBR Portal")
    parser.add_argument("--once", action="store_true", help="Kør kun én polling-cyklus")
    parser.add_argument("--dry-run", action="store_true", help="Vis beskeder uden at sende eller gemme state")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
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
    allowed_senders = configured_allowed_senders()

    if allowed_senders:
        LOG.info("Afsenderfilter aktivt for %s nummer(e)", len(allowed_senders))
    else:
        LOG.warning("ALARM_ALLOWED_SENDERS er ikke sat; SMS fra alle afsendere accepteres")

    LOG.info("SMS-worker startet; polling hvert %s sekund", poll_seconds)
    while True:
        try:
            processed = process_once(
                portal_url,
                token,
                config,
                state_path,
                forwarded,
                allowed_senders,
                args.dry_run,
            )
            if args.once:
                LOG.info("Én polling-cyklus afsluttet; %s ny(e) besked(er)", processed)
                return
        except subprocess.CalledProcessError as exc:
            LOG.error("Gammu-kommando fejlede: %s", exc.stderr or exc)
        except urllib.error.HTTPError as exc:
            LOG.error("Portal afviste besked med HTTP %s", exc.code)
        except (urllib.error.URLError, TimeoutError) as exc:
            LOG.error("Kunne ikke kontakte portalen: %s", exc)
        except Exception:
            LOG.exception("Uventet fejl i SMS-worker")

        if args.once:
            raise SystemExit(1)
        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
