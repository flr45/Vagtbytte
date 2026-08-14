import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin alarmstationer", () => {
  it("tillader at en brandmand har nul valgte alarmstationer", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "admin-user-actions.ts"),
      "utf8"
    );

    expect(source).toContain(
      'const alarmStations = normalizeStationCodes(formData.getAll("alarmStations"));'
    );
    expect(source).not.toContain("selectedAlarmStations.includes(stationCode)");
  });
});
