# SBR Portal – GDPR og databeskyttelse

## Formål og status

Dette dokument beskriver den tekniske GDPR-baseline for SBR Portal. Det er ikke en juridisk certificering. Den dataansvarlige skal fortsat fastlægge behandlingsgrundlag, formål, slettefrister, databehandlere, de registreredes information og organisatoriske procedurer.

SBR Portal skal udvikles efter principperne om databeskyttelse gennem design og standardindstillinger. Det betyder blandt andet, at persondata kun må indsamles, vises, deles, caches og opbevares, når det er nødvendigt for et dokumenteret formål.

## Datakategorier i systemet

SBR Portal behandler blandt andet:

- brugeridentitet: navn, medarbejdernummer, login-id, e-mail og eventuelt telefonnummer
- stationstilknytning, roller og adgangsrettigheder
- vagttilgængelighed, vagtbytter, retursager og kommentarer
- login- og sikkerhedsdata, herunder IP-adresse, loginforsøg, sessioner og auditlogs
- MFA-data: krypteret TOTP-secret, hashed recovery-koder og kortlivede MFA-challenges
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
| Restore-sikre slettefingeraftryk | 365 dage |
| Udløbne sessioner | slettes automatisk |
| Udløbne MFA-challenges | slettes automatisk |
| Udløbne password-reset-tokens | slettes automatisk |

Fristerne er tekniske defaults, ikke en juridisk konklusion. Hvis en anden frist vælges, skal formålet og nødvendigheden dokumenteres. Slettefingeraftryk skal som minimum bevares længere end den ældste backup, der lovligt kan gendannes.

### Brugersletning og backup-restore

Når en brandmandsbruger slettes, fjernes login-kontoen, historiske personhenførbare snapshots i vagtbytter og retursager anonymiseres, relaterede notifikationer fjernes, direkte loginhistorik for den pågældende slettes, og auditbeskrivelser knyttet til brugeren neutraliseres.

Ved brugersletning opretter databasen desuden et minimalt slettefingeraftryk baseret på en envejs-fingerprint af det interne bruger-id. Fingeraftrykket indeholder ikke navn, mail eller medarbejdernummer og ligger uden for backupindholdet. Hvis en administreret backup senere forsøger at gendanne den tidligere slettede bruger, anvendes fingeraftrykket automatisk ved afslutningen af restore-transaktionen, og de gendannede personhenførbare oplysninger anonymiseres/slettes igen.

Restore-flowet markerer den kontrollerede tømning af databasen som restore-mode, så eksisterende aktive brugere ikke fejlagtigt registreres som slettede under selve gendannelsen.

Nye backupfiler bruger format v2. De indeholder både de almindelige databaseposter og hele Operativ Portals databasehierarki samt de fysiske billeder og dokumenter i samme krypterede pakke. Hver fysisk fil har SHA-256-kontrolsum og størrelse i manifestet, og restore afvises før databaseændringer, hvis filintegritet eller 1:1-forholdet mellem database og filpakke ikke stemmer.

V2-restore forbereder og kontrollerer filer før database-transaktionen. Hvis databasetransaktionen fejler, fjernes kun de filer, som restore selv nåede at oprette. Først efter en vellykket database-restore fjernes gamle filer, som ikke findes i det gendannede snapshot.

Ældre v1-backups kan fortsat gendannes. Da de aldrig indeholdt Operativ Portals databasehierarki eller fysiske filer, lader en v1-restore Operativ Portal urørt i stedet for at slette indhold, som backupen ikke kan genskabe.

Den nuværende v2-motor samler operative filer i hukommelsen før komprimering og kryptering. Derfor er standardgrænsen `BACKUP_MAX_OPERATIONAL_BYTES=536870912` (512 MiB). Grænsen bør ikke hæves uden en konkret RAM-vurdering; hvis indholdet vokser væsentligt, skal backupformatet omlægges til streaming.

Historiske hændelser kan bevares i anonymiseret form, når det fortsat er nødvendigt for systemets funktion, dokumentation eller statistik.

### Multifaktorautentifikation

SBR Portal har TOTP-baseret MFA, kompatibel med almindelige authenticator-apps. Som standard håndhæves MFA for:

- administratorer
- Vagtcentral-brugere
- brugere med administratoradgang
- brugere med adgang til Operativ Portal

Håndhævelsen kan sættes til alle brugere via `MFA_ENFORCEMENT_MODE=all`. `off` er kun tiltænkt en dokumenteret nødprocedure.

MFA er bygget uden ekstern QR-/provisioning-tjeneste. Opsætningen viser en manuel TOTP-nøgle direkte i den autentificerede opsætningssession. TOTP-secret lagres krypteret med AES-256-GCM. En særskilt MFA-krypteringsnøgle kan konfigureres; ellers afledes en domæneadskilt nøgle fra `AUTH_SECRET`.

Der genereres 10 recovery-koder. De vises kun under opsætningen og gemmes derefter kun som domæneadskilte HMAC-hashes. Hver recovery-kode kan kun bruges én gang. TOTP-koder har replay-beskyttelse via senest anvendte tidsstep. En MFA-challenge udløber efter 10 minutter og låses efter fem mislykkede MFA-forsøg.

Administrator kan nulstille MFA for en bruger ved dokumenteret lockout. En nulstilling fjerner secret/recovery-koder, lukker aktive sessioner og auditlogges. Brugeren bliver derefter tvunget gennem ny MFA-opsætning ved næste login, hvis MFA-politikken gælder for kontoen.

### Operative uploads

Operative uploads kontrolleres efter filens faktiske bytes og ikke kun browserens MIME-type. Serveren validerer de understøttede JPEG-, PNG-, WebP-, PDF-, Word- og Excel-formater før permanent lagring.

JPEG-, PNG- og WebP-billeder renses for unødvendig EXIF/GPS/XMP/IPTC-/kommentarmetadata uden at sende filen til en ekstern billedtjeneste. Uploadede filer gemmes med begrænsede filrettigheder (`0600`). Storage-filnavne behandles som potentielt fjendtligt input ved download og sletning, så path traversal og absolutte stier afvises.

PDF og billeder kan vises inline efter autentifikation. Office-dokumenter leveres som download (`attachment`) for at reducere browserens angrebsflade.

### Offline-data

Operativ offline-cache er opt-in og må kun aktiveres på en betroet enhed. SBR Portal må ikke automatisk cache beskyttet operativt indhold alene fordi en bruger besøger en side.

Offline-cachen:

- aktiveres først ved en eksplicit synkronisering
- erstattes ved ny synkronisering, så udgåede ressourcer ikke bliver liggende
- udløber automatisk efter 24 timer
- ryddes ved autentifikationsfejl og ved login-flow
- kan ryddes manuelt af brugeren
- efterlades ikke som delvis cache, hvis en synkronisering fejler

### GDPR-brugerudtræk

Administrator kan generere et internt JSON-udtræk for en bruger fra Brugeroverblik. Udtrækket samler relevante konto-, login-, MFA-status-, vagt-, notifikations-, audit- og Operativ Portal-data og auditlogger selve genereringen.

Udtrækket udelader sikkerhedscredentials, herunder password-hash, session-/reset-token hashes, MFA-secret, recovery-hashes, MFA-challenge secrets/tokens, push-kryptografinøgler og den fulde push-endpoint-URL. Kun push-providerens origin medtages.

Udtrækket er et hjælpeværktøj og markeres som en intern kladde, der kræver menneskelig gennemgang før udlevering. Kommentarer, notifikationer og sagskontekst kan indeholde oplysninger om andre personer og skal vurderes i den konkrete indsigtsanmodning.

## Sikkerhed

Følgende er en del af den tekniske baseline:

- individuelle brugere og rollebaseret adgang
- særskilt adgangsgrant til Operativ Portal
- password hashing
- MFA for privilegerede og Operativ Portal-brugere som standard
- krypterede TOTP-secrets og hashed engangs-recovery-koder
- HttpOnly-session-cookie, SameSite og Secure i produktion
- kortlivet HttpOnly MFA-challenge-cookie
- login-rate-limit, MFA-forsøgsgrænse og audit
- TLS/HTTPS og HSTS i produktion
- håndhævet Content-Security-Policy med begrænsede eksterne kilder
- `no-store` på beskyttede operative sider/dokumenter, bortset fra den eksplicitte og tidsbegrænsede offline-funktion
- faktisk filtypekontrol og metadata-rensning ved operative uploads
- filstorage med path-traversal-beskyttelse og begrænsede filrettigheder
- krypterede v2-backups med database, Operativ Portal og filintegritetskontrol
- restore-sikker slettejournal, der ikke er en del af de administrerede backupfiler
- production dependency security gate i CI, som stopper nye high/critical advisories med kun snævert dokumenterede undtagelser
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
10. **Periodisk kontrol** – test af adgangsrettigheder, MFA, slettejobs, backup/restore, logs, sikkerhedsheaders og offline-cache.

## Åbne tekniske højprioriteter

De tidligere P0-punkter MFA og restore-sikker brugersletning samt uploadvalidering, billedmetadata-rensning, CSP og brugerudtræk er implementeret. De væsentligste resterende tekniske punkter er:

### P1 – datakryptering på persistent filstorage

Operative billeder og dokumenter ligger i persistent storage. Der skal dokumenteres, om hostens disk/volume er krypteret ved hvile, eller implementeres volume-/applikationskryptering, hvis infrastrukturen ikke allerede leverer dette. Backupfilerne er separat krypteret med AES-256-GCM.

### P1 – retention for arbejds-/vagthistorik

Availability, ShiftTransfer og ReturnRequest indeholder arbejdsrelateret historik. Der skal fastsættes en dokumenteret retention for aktive og afsluttede poster. Først derefter bør den automatiske slette/anonymiseringsmotor udvides til disse tabeller.

### P1 – recovery- og nødprocedure for systemkonti

Der skal dokumenteres en organisatorisk nødprocedure for MFA-lockout på de primære ADMIN/VC-systemkonti, herunder identitetskontrol, hvem der må gennemføre reset, og hvordan handlingen efterkontrolleres. Recovery-koder er den primære tekniske fallback.

### P1 – reel restore-øvelse og streaming-backup ved vækst

Backup/restore er dækket af unit-/buildtests, men organisationen skal periodisk gennemføre en kontrolleret restore-øvelse på et isoleret miljø. Hvis Operativ Portals filsamling nærmer sig den konfigurerede RAM-grænse, skal backupmotoren ændres til et streamet format i stedet for blot at hæve grænsen.

### P2 – malware-scanning af dokumentuploads

Filtypekontrol og billedmetadata-rensning reducerer risikoen, men dokumentuploads bliver ikke antivirusscannet. Hvis trusselsmodellen, antallet af uploadere eller dokumentkilder ændrer sig, bør lokal malware-scanning vurderes.

## Kontrol efter deployment

Efter hver ændring i databeskyttelsesfunktionerne skal følgende kontrolleres:

- slettejobbet kører og rapporterer forventede tal
- poster ældre end fristerne er faktisk væk fra databasen
- slettede brugere kan ikke genskabes som personhenførbare gennem normal brugerflade
- en gammel administreret backup genindfører ikke en tidligere slettet bruger efter restore
- slettefingeraftrykkenes retention er længere end backupretentionen
- gamle offline-caches kan ikke læses efter udløb
- logout/login-fejl rydder lokal operativ cache
- nye backups oprettes som krypterede v2-pakker og indeholder Operativ Portals databasehierarki samt alle refererede billeder/dokumenter
- en manipuleret eller ufuldstændig v2-backup afvises før databaseændringer
- en v1-backup lader Operativ Portal urørt
- direkte restore fra serverens backupliste fungerer for store backupfiler uden web-upload
- worker- og web-containeren har samme Operativ Portal-volume monteret
- adgang til Operativ Portal afvises uden korrekt grant
- privilegerede og Operativ Portal-brugere bliver tvunget gennem MFA
- en brugt TOTP-kode kan ikke genbruges i samme tidsstep
- en recovery-kode forsvinder efter første brug
- admin-MFA-reset lukker eksisterende sessioner og kræver ny MFA-opsætning
- GDPR-brugerudtræk indeholder ikke passwords, MFA-secrets, token hashes eller push-kryptografinøgler

## Referencer

- GDPR artikel 5: principper, dataminimering, opbevaringsbegrænsning og integritet/fortrolighed
- GDPR artikel 13-15 og 17: information, indsigt og sletning
- GDPR artikel 25: databeskyttelse gennem design og standardindstillinger
- GDPR artikel 30: fortegnelse over behandlingsaktiviteter
- GDPR artikel 32: behandlingssikkerhed
- GDPR artikel 33-34: brud på persondatasikkerheden
- GDPR artikel 35: konsekvensanalyse (DPIA)
- Datatilsynets vejledninger om sletning, MFA, risikovurdering, konsekvensanalyse og sikkerhedsbrud
