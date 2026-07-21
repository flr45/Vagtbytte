# Vagtoverdragelse

Webprojekt til håndtering af midlertidig overdragelse af en igangværende brandmandsvagt.

Dette er del 1 af løsningen. Projektet er ikke et vagtplanssystem og indeholder derfor ingen kalender, månedsvisning, vagthold, kommende vagtplaner eller overblik over andre brandmænd.

## Forudsætninger

- Node.js
- npm

## Installation

```bash
npm install
cp .env.example .env
```

Ret eventuelt værdierne i `.env`. Til lokal udvikling bruges SQLite med `DATABASE_URL="file:./dev.db"`.

## Miljøvariabler

`.env.example` viser de nødvendige værdier:

- `DATABASE_URL`
- `AUTH_SECRET`
- `SEED_ADMIN_PASSWORD`
- `SEED_VC_PASSWORD`
- `SEED_FIREFIGHTER_PASSWORD`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NOTIFICATIONS_DISABLE_PUSH`

Den rigtige `.env` skal blive lokalt og må ikke committes.

## Databaseopsætning

Kør migration og seed:

```bash
npx prisma migrate dev
npx prisma db seed
```

## Lokal opstart

```bash
npm run dev
```

Åbn derefter `http://localhost:3000`.

## Testlogin til lokal udvikling

Hvis du bruger værdierne fra `.env.example`:

- Admin: `admin` / `Admin123!`
- Vagtcentral: `vc` / `Vc123456!`
- Brandmand A: `1001` / `Brand123!`
- Brandmand B: `1002` / `Brand123!`

## Roller

- `BRANDFIGHTER`: personlig brandmandskonto. Kan i del 1 logge ind og se egen startside.
- `VC`: fælles konto til vagtcentralen. Kan i del 1 logge ind og se en enkel VC-side.
- `ADMIN`: separat login. Kan administrere brandmænd, VC-konto og se en enkel revisionslog.

Admin kan ikke udgive sig for at være brandmand og får ikke adgang til vagtcentralens godkendelsesområde alene på grund af adminrollen.

## Implementeret indtil nu

- Next.js med App Router og TypeScript
- Tailwind CSS
- SQLite-database via Prisma til lokal udvikling
- Brugere, roller, sessioner, loginforsøg og revisionslog
- Sikker adgangskode-hashing
- HTTP-only sessionscookie med SameSite og Secure i produktion
- Beskyttelse mod gentagne loginforsøg
- Server-side adgangskontrol for `/brandmand`, `/vagtcentral` og `/admin`
- Fælles loginformular
- Tvunget adgangskodeskift ved `mustChangePassword`
- Adminside til oprettelse, redigering, aktivering/deaktivering og nulstilling af brandmænd
- Adminside til vedligeholdelse af den fælles VC-konto
- Seed-data til én admin, én VC-konto og to brandmænd
- Automatiske tests for centrale login- og rolletjek
- Oprettelse af vagtoverdragelser mellem to brandmænd
- Accept eller afvisning hos modtageren
- Vagtcentralens godkendelse eller afvisning af accepterede vagtoverdragelser
- Aktiv vagtoverdragelse efter VC-godkendelse
- Manuel tilbagelevering fra overtager til oprindelig brandmand
- Accept eller afvisning af tilbagelevering hos oprindelig brandmand
- Endelig VC-godkendelse eller afvisning af tilbagelevering
- Permanent notifikationscenter for brandmænd og vagtcentralen
- Registrering og fjernelse af push-enheder
- Testnotifikationer
- Planlagte start- og forventet-sluttid-notifikationer via lokal worker

## Ikke implementeret endnu

- Historik for vagtoverdragelser
- Driftshærdning ud over fundamentet i del 1

## Notifikationer

In-app-notifikationer gemmes permanent i databasen og er systemets sikre beskedkanal. Browser-push er kun en ekstra kanal og er ikke en garanti for, at brugeren har læst beskeden.

Brandmænd finder beskeder på `/brandmand/notifikationer`. Vagtcentralen finder beskeder på `/vagtcentral/notifikationer`.

Lokale VAPID-nøgler kan genereres med:

```bash
npm run notifications:generate-keys
```

Service worker aktiveres først, når brugeren trykker “Aktivér notifikationer” på notifikationssiden. En testnotifikation kan sendes fra samme side.

Planlagte beskeder behandles enkeltstående med:

```bash
npm run notifications:process
```

Til løbende lokal test bruges to terminaler:

```bash
npm run dev
```

```bash
npm run notifications:worker
```

Hvis push fejler eller ikke er aktiveret, fortsætter sagerne uændret inde i systemet. Produktionshosting og permanent worker opsættes senere.

## Kvalitetstjek

```bash
npm test
npm run lint
npm run build
```

Næste større trin er samlet historik, sikkerhedsgennemgang og driftshærdning.
