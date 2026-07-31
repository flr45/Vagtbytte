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
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LOG = logging.getLogger("sbr-alarm-sms-worker")


@dataclass(frozen=True)
class SmsMessage:
    location: int
    folder: int
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
    # Keep the file bounded. The API also performs its own deduplication.
    latest = sorted(forwarded)[-5000:]
    temporary.write_text(json.dumps({"forwarded": latest}), encoding="utf-8")
    temporary.replace(path)


def run_gammu(config: str | None) -> dict[str, Any]:
    command = ["gammu"]
    if config:
        command.extend(["--config", config])
    command.extend(["getallsms", "-raw", "-unicode"])

    # Gammu's normal text output is difficult to parse reliably. This worker
    # expects the helper command configured below to emit JSON when available.
    json_command = os.getenv("GAMMU_JSON_COMMAND", "").strip()
    if not json_command:
        raise RuntimeError(
            "GAMMU_JSON_COMMAND mangler. Angiv en kommando, der returnerer SMS'er som JSON. "
            "Se docs/alarm-feed-raspberry-pi.md."
        )

    completed = subprocess.run(
        json_command,
        shell=True,
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, "GAMMU_CONFIG": config or ""},
    )
    return json.loads(completed.stdout)


def parse_messages(payload: dict[str, Any]) -> list[SmsMessage]:
    messages: list[SmsMessage] = []
    for item in payload.get("messages", []):
        text = str(item.get("text", "")).strip()
        sender = str(item.get("sender", "")).strip()
        if not text or not sender:
            continue
        messages.append(
            SmsMessage(
                location=int(item.get("location", 0)),
                folder=int(item.get("folder", 0)),
                sender=sender,
                text=text,
                timestamp=str(item.get("timestamp") or datetime.now(timezone.utc).isoformat()),
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
            payload = run_gammu(config)
            for message in parse_messages(payload):
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
