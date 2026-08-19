# SBR Portal – GDPR og databeskyttelse

## Formål og status

Dette dokument beskriver den tekniske GDPR-baseline for SBR Portal. Det er ikke en juridisk certificering. Den dataansvarlige skal fortsat fastlægge behandlingsgrundlag, formål, slettefrister, databehandlere, de registreredes information og organisatoriske procedurer.

SBR Portal skal udvikles efter principperne om databeskyttelse gennem design og standardindstillinger. Det betyder blandt andet, at persondata kun må indsamles, vises, deles, caches og opbevares, når det er nødvendigt for et dokumenteret formål.

## Datakategorier i systemet

SBR Portal/Vagtbytte behandler blandt andet:

- brugeridentitet: navn, medarbejdernummer, login-id, e-mail og eventuelt telefonnummer
- stationstilknytning, roller og adgangsrettigheder
- vagttilgængelighed, vagtbytter, retursager og kommentarer
- login- og sikkerhedsdata, herunder IP-adresse, loginforsøg, sessioner og auditlogs
- push-enheder og push-leveringsoplysninger
- alarmdata, herunder afsendernummer og rå alarmtekst
- brugerens favoritter og senest viste elementer i Operativ Portal
- uploadede operative billeder og dokumenter

Rå alarmtekster og uploadede filer skal behandles som beskyttelsesværdigt indhold. De kan i praksis indeholde oplysninger om identificerbare personer, herunder oplysninger der kræver et højere beskyttelsesniveau.

## Tekniske standardindstillinger

### Automatisk retention

Standardfristerne i systemet er konfigurerbare og skal godkendes af den dataansvarlige:

| Data | Teknisk standard |
| --- | ---: |
| Rå alarmdata og alarmnotifikationer | 90 dage |
| Backups | 90 dage |
| Loginforsøg/IP-oplysninger | 90 dage |
| Almindelige notifikationer | 180 dage |
| Auditlogs | 365 dage |
| Operativ Portal “senest set” | 30 dage |
| Udløbne sessioner | slettes automatisk |
| Udløbne password-reset-tokens | slettes automatisk |

Fristerne er tekniske defaults, ikke en juridisk konklusion. Hvis en anden frist vælges, skal formålet og nødvendigheden dokumenteres.

### Brugersletning

Når en brandmandsbruger slettes, skal systemet ikke blot fjerne login-kontoen. Historiske personhenførbare snapshots i vagtbytter og retursager anonymiseres, relaterede notifikationer fjernes, direkte loginhistorik for den pågældende slettes, og auditbeskrivelser knyttet til brugeren neutraliseres.

Historiske hændelser kan bevares i anonymiseret form, når det fortsat er nødvendigt for systemets funktion, dokumentation eller statistik.

### Offline-data

Operativ offline-cache er opt-in og må kun aktiveres på en betroet enhed. SBR Portal må ikke automatisk cache beskyttet operativt indhold alene fordi en bruger besøger en side.

Offline-cachen:

- aktiveres først ved en eksplicit synkronisering
- erstattes ved ny synkronisering, så udgåede ressourcer ikke bliver liggende
- udløber automatisk efter 24 timer
- ryddes ved autentifikationsfejl og ved login-flow
- kan ryddes manuelt af brugeren
- efterlades ikke som delvis cache, hvis en synkronisering fejler

## Sikkerhed

Følgende er allerede en del af eller skal være en del af baselinen:

- individuelle brugere og rollebaseret adgang
- særskilt adgangsgrant til Operativ Portal
- password hashing
- HttpOnly-session-cookie, SameSite og Secure i produktion
- login-rate-limit og audit
- TLS/HTTPS og HSTS i produktion
- `no-store` på beskyttede operative sider/dokumenter, bortset fra den eksplicitte og tidsbegrænsede offline-funktion
- krypterede backups med begrænset retention
- ingen fuld rå alarmtekst i push-notifikationer på låseskærmen

## Krav før systemet kan betegnes som organisatorisk GDPR-klargjort

Den dataansvarlige skal udfylde og godkende følgende:

1. **Dataansvarlig og kontaktpunkt** – navn på organisation, kontaktoplysninger og eventuel DPO/databeskyttelsesrådgiver.
2. **Formål og behandlingsgrundlag** – dokumenteres separat for brugeradministration, vagtdata, alarmdata, operative filer, sikkerhedslogs og statistik. Samtykke må ikke anvendes som standardgrundlag uden en konkret vurdering.
3. **Oplysningspligt** – brugerne skal have en tydelig privatlivstekst med formål, datakategorier, modtagere, opbevaring, rettigheder, klageadgang og relevante kontaktoplysninger.
4. **Artikel 30-fortegnelse** – behandlingsaktiviteterne skal indgå i organisationens fortegnelse.
5. **Databehandleraftaler** – alle leverandører/underdatabehandlere, der kan behandle data, skal kortlægges og kontraktligt vurderes, herunder hosting, mail, push, DNS/CDN og backup-løsninger.
6. **Tredjelandsoverførsler** – eventuelle leverandører eller supportadgange uden for EU/EØS skal identificeres og have gyldigt overførselsgrundlag.
7. **Risikovurdering og DPIA-screening** – systemets internetadgang, medarbejderdata, rå alarmtekst, operative filer og mobil/offline-funktion skal indgå i en konkret risikovurdering. Der skal gennemføres DPIA, hvis behandlingen sandsynligvis medfører høj risiko.
8. **Rettighedsprocedure** – procedure for indsigt, rettelse, sletning/anonymisering, begrænsning og øvrige relevante registreredes rettigheder.
9. **Sikkerhedsbrud** – intern procedure for registrering, risikovurdering, eskalering og eventuel anmeldelse inden for GDPR-fristen.
10. **Periodisk kontrol** – test af adgangsrettigheder, slettejobs, backup/restore, logs, sikkerhedsheaders og offline-cache.

## Åbne tekniske højprioriteter

### P0 – MFA

Internetadgang til SBR Portal skal beskyttes med multifaktorautentifikation eller en dokumenteret tilsvarende sikkerhedsforanstaltning, når risikovurderingen viser det nødvendigt. Administratorer skal prioriteres først, men målet er MFA for alle brugere med adgang til beskyttelsesværdigt operativt/personhenførbart indhold.

### P0 – sletning efter backup-restore

En backup kan indeholde oplysninger, der er blevet slettet efter backup-tidspunktet. Restore-flowet skal derfor have en persistent, dataminimeret slette-/anonymiseringsjournal, som ikke overskrives af restore, og som genanvender relevante sletninger/anonymiseringer umiddelbart efter en gendannelse.

### P1 – metadata i billeder og dokumenter

Uploadede billeder bør re-encodes eller renses for unødvendig EXIF/XMP/GPS-metadata. Filvalidering skal baseres på faktisk filindhold og ikke alene browserens MIME-type. Dokumentuploads bør gennemgås for samme princip og eventuelt malware-scanning afhængigt af miljøet.

### P1 – datakryptering på persistent filstorage

Operative billeder og dokumenter ligger i persistent storage. Der skal dokumenteres kryptering på lagermediet eller implementeres applikations-/volume-kryptering, hvis infrastrukturen ikke allerede leverer dette.

### P1 – CSP

Der bør implementeres en testet Content-Security-Policy, som er kompatibel med Next.js-applikationen og ikke kræver unødigt brede `unsafe-*` undtagelser.

### P1 – databruger-eksport

Admin bør have et værktøj, der kan samle de personoplysninger, som knytter sig til en bestemt bruger, så organisationen kan håndtere indsigtsanmodninger effektivt. En sådan eksport er et hjælpeværktøj og erstatter ikke den dataansvarliges juridiske vurdering af en konkret indsigtsanmodning.

### P1 – retention for arbejds-/vagthistorik

Availability, ShiftTransfer og ReturnRequest indeholder arbejdsrelateret historik. Der skal fastsættes en dokumenteret retention for aktive og afsluttede poster. Først derefter bør den automatiske slette/anonymiseringsmotor udvides til disse tabeller.

## Kontrol efter deployment

Efter hver ændring i databeskyttelsesfunktionerne skal følgende kontrolleres:

- slettejobbet kører og rapporterer forventede tal
- poster ældre end fristerne er faktisk væk fra databasen
- slettede brugere kan ikke genskabes som personhenførbare gennem normal brugerflade
- gamle offline-caches kan ikke læses efter udløb
- logout/login-fejl rydder lokal operativ cache
- backups er krypterede, kan gendannes og følger retention
- en restore genindfører ikke data, der retteligt er slettet/anonymiseret
- adgang til Operativ Portal afvises uden korrekt grant
- alle internetvendte privilegerede konti er beskyttet med MFA, når MFA-fasen er gennemført

## Referencer

- GDPR artikel 5: principper, dataminimering, opbevaringsbegrænsning og integritet/fortrolighed
- GDPR artikel 13-15 og 17: information, indsigt og sletning
- GDPR artikel 25: databeskyttelse gennem design og standardindstillinger
- GDPR artikel 30: fortegnelse over behandlingsaktiviteter
- GDPR artikel 32: behandlingssikkerhed
- GDPR artikel 33-34: brud på persondatasikkerheden
- GDPR artikel 35: konsekvensanalyse (DPIA)
- Datatilsynets vejledninger om sletning, MFA, risikovurdering, konsekvensanalyse og sikkerhedsbrud
