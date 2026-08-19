import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src", "lib", "admin-user-actions.ts"),
  "utf8"
);

describe("admin alarmstationer", () => {
  it("tillader at en brandmand har nul valgte alarmstationer", () => {
    expect(source).toContain(
      'const alarmStations = normalizeStationCodes(formData.getAll("alarmStations"));'
    );
    expect(source).not.toContain("selectedAlarmStations.includes(stationCode)");
  });
});

describe("GDPR brugersletning", () => {
  it("anonymiserer snapshots og auditbeskrivelser før brugeren slettes", () => {
    expect(source).toContain('const ANONYMIZED_NAME = "Slettet bruger"');
    expect(source).toContain('const ANONYMIZED_EMPLOYEE_NUMBER = "ANONYMISERET"');
    expect(source).toContain("giverNameSnapshot: ANONYMIZED_NAME");
    expect(source).toContain("receiverNameSnapshot: ANONYMIZED_NAME");
    expect(source).toContain("originalNameSnapshot: ANONYMIZED_NAME");
    expect(source).toContain("currentHolderNameSnapshot: ANONYMIZED_NAME");
    expect(source).toContain('description: "Historisk hændelse vedrørende anonymiseret bruger"');
    expect(source).not.toContain("`${target.name} (${target.employeeNumber");
  });
});
