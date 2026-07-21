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

Ret eventuelt værdierne i `.env`. Efter produktionsklargøringen bruger Prisma PostgreSQL.
Til lokal udvikling skal `DATABASE_URL` derfor pege på en lokal eller ekstern PostgreSQL-database.
SQLite-data fra de første lokale udviklingsfaser flyttes ikke automatisk.

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
- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_VC_USERNAME`
- `BOOTSTRAP_VC_PASSWORD`

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
- PostgreSQL-database via Prisma
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

## Forventet tilbagelevering

Ved oprettelse vælger brandmanden enten `Bestemt tidspunkt` eller `Til vagt slut`.
Et bestemt tidspunkt bruges kun som påmindelse og afslutter aldrig sagen automatisk.
Tilbagelevering kræver stadig manuel oprettelse fra B, accept fra A og godkendelse fra vagtcentralen.

Migrationen til `expectedEndMode` behandler eksisterende lokale sager sådan:
sager med `expectedEndAt` bliver `SPECIFIC_TIME`, og sager uden `expectedEndAt` bliver `UNTIL_SHIFT_END`.

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

## Render og PostgreSQL

Første online testversion oprettes med `render.yaml` i projektets rod.
Blueprintet opretter:

- `vagtbytte-db`: PostgreSQL-database
- `vagtbytte-web`: Next.js webservice
- `vagtbytte-worker`: separat worker til notifikationer

Webservice bruger:

```bash
npm install && npm run build
npm run db:deploy
npm run start
```

Worker bruger:

```bash
npm install && npx prisma generate
npm run notifications:worker
```

Render skal have disse miljøvariabler udfyldt:

- `DATABASE_URL`: sættes fra Render-databasen med `fromDatabase`
- `AUTH_SECRET`: lang hemmelig session-nøgle, kun webservice
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: offentlig VAPID-nøgle
- `VAPID_PRIVATE_KEY`: privat VAPID-nøgle, må aldrig være offentlig
- `VAPID_SUBJECT`: fx `mailto:drift@example.dk`
- `NOTIFICATIONS_DISABLE_PUSH=false`
- `NODE_ENV=production`

Worker-planen i blueprintet er `starter`, fordi Render typisk ikke tilbyder en
gratis permanent worker. Planen kan ændres manuelt i Render-dashboardet.

### Migrationer i produktion

Produktion bruger kun:

```bash
npm run db:deploy
```

Det kører `prisma migrate deploy`. Brug ikke `prisma migrate dev` eller
`prisma migrate reset` i produktion.

Den gamle SQLite-historik ligger i `prisma/migrations_sqlite_archive`.
Den nye PostgreSQL-historik starter med `prisma/migrations/20260721190000_init_postgresql`.
Produktionsdatabasen er tom, og lokal SQLite-data overføres ikke automatisk.

### Første admin og VC

Der seedes ikke testbrugere i produktion. Opret første admin og VC manuelt fra
Render Shell efter migration:

```bash
npm run production:bootstrap
```

Kommandoen kræver:

- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_VC_USERNAME`
- `BOOTSTRAP_VC_PASSWORD`

Den nægter at køre, hvis der allerede findes en admin eller VC. Begge konti får
`mustChangePassword=true`, og adgangskoder logges ikke.

### Health check og drift

Render bruger `/api/health` som health check. Endpointet returnerer kun:

```json
{ "status": "ok" }
```

Det afslører ikke databaseadresse, miljøvariabler eller brugeroplysninger.

Efter deploy kontrolleres:

- webservice logs: Render-dashboard > `vagtbytte-web` > Logs
- worker logs: Render-dashboard > `vagtbytte-worker` > Logs
- database: Render-dashboard > `vagtbytte-db`
- health check: åbn `https://DIN-RENDER-URL/api/health`

Rollback sker fra Render-dashboardet ved at vælge en tidligere deploy for
webservice og worker. Databasemigrationer skal vurderes særskilt før rollback.

### Push på telefon

Push kræver HTTPS, VAPID-nøgler og at brugeren aktiverer notifikationer fra
notifikationssiden. På iPhone kræver webpush normalt, at webappen først er
installeret på hjemmeskærmen.

## Kvalitetstjek

```bash
npm test
npm run lint
npm run build
```

Næste større trin er første Render-deploy og manuel bootstrap af produktionskonti.
