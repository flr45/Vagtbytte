# Alarmfeed på Raspberry Pi

Denne worker læser indgående SMS'er fra Huawei-modemmet med Gammu og sender originalteksten til SBR Portal.

Pageren er fortsat den officielle alarmering. Alarmfeed er kun et supplement.

## 1. Forudsætninger

Kontrollér først modemmet:

```bash
gammu identify
gammu getallsms
```

Installer nødvendige pakker:

```bash
sudo apt update
sudo apt install -y gammu python3
```

Projektet forventes placeret i:

```text
/opt/sbr-portal
```

## 2. Miljøfil

Opret filen:

```bash
sudo nano /etc/sbr-alarm-feed.env
```

Indhold:

```bash
SBR_PORTAL_URL=https://DIN-PORTAL-URL
ALARM_FEED_INGEST_TOKEN=INDSAET_EN_LANG_TILFAELDIG_HEMMELIGHED
ALARM_ALLOWED_SENDERS=+45XXXXXXXX
GAMMU_CONFIG=/home/pi/.gammurc
SMS_POLL_SECONDS=10
SMS_STATE_FILE=/var/lib/sbr-alarm-feed/state.json
LOG_LEVEL=INFO
```

`ALARM_ALLOWED_SENDERS` bør indeholde vagtcentralens afsendernummer. Flere numre adskilles med komma.

Eksempel:

```bash
ALARM_ALLOWED_SENDERS=+4512345678,+4587654321
```

Den samme værdi til `ALARM_FEED_INGEST_TOKEN` skal ligge som miljøvariabel på webappen.

Beskyt miljøfilen:

```bash
sudo chmod 600 /etc/sbr-alarm-feed.env
```

## 3. Test uden at sende

Kør én aflæsning og vis, hvad worker ville sende:

```bash
cd /opt/sbr-portal
sudo -u pi bash -c 'set -a; source /etc/sbr-alarm-feed.env; set +a; python3 scripts/alarm-sms-worker.py --once --dry-run'
```

Worker skal vise de nye SMS'er i loggen uden at kontakte portalen.

## 4. Test med portal

Når dry-run ser korrekt ud:

```bash
cd /opt/sbr-portal
sudo -u pi bash -c 'set -a; source /etc/sbr-alarm-feed.env; set +a; python3 scripts/alarm-sms-worker.py --once'
```

Kontrollér derefter siden:

```text
/brandmand/alarmer
```

Den originale SMS-tekst skal stå uændret.

## 5. Installer systemd-service

```bash
sudo mkdir -p /var/lib/sbr-alarm-feed
sudo chown pi:pi /var/lib/sbr-alarm-feed
sudo cp deploy/sbr-alarm-sms-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sbr-alarm-sms-worker
```

Status:

```bash
systemctl status sbr-alarm-sms-worker
```

Live-log:

```bash
journalctl -u sbr-alarm-sms-worker -f
```

Genstart:

```bash
sudo systemctl restart sbr-alarm-sms-worker
```

## 6. Dubletbeskyttelse

Worker gemmer allerede videresendte beskeder i:

```text
/var/lib/sbr-alarm-feed/state.json
```

Webappen har også sin egen dubletbeskyttelse. En genstart af Raspberry Pi eller webappen bør derfor ikke skabe dobbelte alarmmeldinger.

## 7. Fejlsøgning

### Gammu kan ikke finde modemmet

```bash
ls -l /dev/ttyUSB*
gammu identify
```

Kontrollér `.gammurc` og at brugeren `pi` har adgang til den relevante serielle port.

### Worker ignorerer en korrekt alarm-SMS

Sammenlign afsenderen fra:

```bash
gammu getallsms
```

med `ALARM_ALLOWED_SENDERS`. Nummeret normaliseres for mellemrum, parenteser og bindestreger, men landekoden skal stadig passe.

### Portalen svarer 401

`ALARM_FEED_INGEST_TOKEN` er forskellig på Raspberry Pi og webappen, eller mangler et af stederne.

### Ingen push

Kontrollér først, om SMS'en kan ses i Alarmfeed. Hvis den kan ses, virker modem og ingestion. Push-notifikationer fejlsøges derefter separat via notifikationssystemet.
