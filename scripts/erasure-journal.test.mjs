import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260819143000_add_mfa_and_erasure_journal",
    "migration.sql"
  ),
  "utf8"
);
const backupCore = fs.readFileSync(
  path.join(process.cwd(), "scripts", "backup-core.mjs"),
  "utf8"
);

describe("restore-sikker slettejournal", () => {
  it("gemmer kun et fingerprint og bruger en deferred restore-trigger", () => {
    expect(migration).toContain('CREATE TABLE "DataErasureTombstone"');
    expect(migration).toContain("md5(OLD.\"id\")");
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER "apply_erasure_tombstone_after_user_insert"');
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(migration).toContain("PERFORM sbr_apply_user_erasure(NEW.\"id\")");
  });

  it("beskytter den kontrollerede database-tømning under restore", () => {
    expect(migration).toContain("current_setting('sbr.restore_mode', true) = '1'");
    expect(backupCore).toContain("set_config('sbr.restore_mode', '1', true)");
  });

  it("anonymiserer personhenførbare snapshots ved genanvendelse af en tombstone", () => {
    expect(migration).toContain('"giverNameSnapshot" = \'Slettet bruger\'');
    expect(migration).toContain('"giverEmployeeNumberSnapshot" = \'ANONYMISERET\'');
    expect(migration).toContain('"receiverNameSnapshot" = \'Slettet bruger\'');
    expect(migration).toContain('"originalNameSnapshot" = \'Slettet bruger\'');
    expect(migration).toContain('"currentHolderNameSnapshot" = \'Slettet bruger\'');
  });
});
