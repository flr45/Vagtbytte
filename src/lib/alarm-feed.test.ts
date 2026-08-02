import { describe, expect, it } from "vitest";
import { detectStationCode, startsNewAlarm } from "./alarm-feed";

describe("detectStationCode", () => {
  it("genkender ISL med parenteser", () => {
    expect(detectStationCode("(ISL) Bygningsbrand")).toBe("ISL");
  });

  it("genkender ISL uden parenteser", () => {
    expect(detectStationCode("ISL Bygningsbrand")).toBe("ISL");
    expect(detectStationCode("Alarm til ISL: Bygningsbrand")).toBe("ISL");
    expect(detectStationCode("isl - assistance")).toBe("ISL");
  });

  it("genkender de korte stationskoder med parenteser", () => {
    expect(detectStationCode("(A) Bygningsbrand")).toBe("A");
    expect(detectStationCode("(B) Assistance")).toBe("B");
    expect(detectStationCode("(S) Bygningsbrand")).toBe("S");
    expect(detectStationCode("(K) Bygningsbrand")).toBe("K");
    expect(detectStationCode("(L) Bygningsbrand")).toBe("L");
    expect(detectStationCode("(R) Bygningsbrand")).toBe("R");
    expect(detectStationCode("A Bygningsbrand")).toBeNull();
    expect(detectStationCode("B Assistance")).toBeNull();
  });

  it("genkender ikke ISL som del af et andet ord", () => {
    expect(detectStationCode("En mislykket melding")).toBeNull();
  });
});

describe("startsNewAlarm", () => {
  it.each([
    "(A) Bygningsbrand",
    "(B) Assistance",
    "(S) Bygningsbrand",
    "(K) Bygningsbrand",
    "(L) Bygningsbrand",
    "(R) Bygningsbrand",
    "(ISL) Bygningsbrand",
    "ISL Bygningsbrand"
  ])("starter en ny alarm for markeret førstesending: %s", (message) => {
    expect(startsNewAlarm(message)).toBe(true);
  });

  it("behandler en besked uden stationsmarkør som en opfølgende sending", () => {
    expect(startsNewAlarm("Test")).toBe(false);
    expect(startsNewAlarm("Mødested ændret til bagsiden")).toBe(false);
  });
});
