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

## Implementeret i del 1

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

## Ikke implementeret endnu

- Oprettelse af vagtoverdragelse
- Accept eller afvisning fra modpart
- Vagtcentralens godkendelse af konkrete anmodninger
- Manuel tilbagelevering
- Push-notifikationer
- Notifikationscenter
- Historik for vagtoverdragelser
- Driftshærdning ud over fundamentet i del 1

## Kvalitetstjek

```bash
npm test
npm run lint
npm run build
```

Del 2 bør først startes, når del 1 er testet og godkendt.
