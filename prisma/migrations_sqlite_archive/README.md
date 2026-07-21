Dette arkiv indeholder den tidligere SQLite-migrationshistorik fra lokal udvikling.

Produktionsversionen på Render bruger PostgreSQL og må ikke køre disse migrationer.
Den nye PostgreSQL-historik starter i `prisma/migrations/20260721190000_init_postgresql`.

Eksisterende lokal SQLite-data overføres ikke automatisk til PostgreSQL. Den første
online testversion starter med en tom produktionsdatabase.
