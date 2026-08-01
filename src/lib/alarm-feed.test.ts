import { describe, expect, it } from "vitest";
import { detectStationCode } from "./alarm-feed";

describe("detectStationCode", () => {
  it("genkender ISL med parenteser", () => {
    expect(detectStationCode("(ISL) Bygningsbrand")) .toBe("ISL");
  });

  it("genkender ISL uden parenteser", () => {
    expect(detectStationCode("ISL Bygningsbrand")) .toBe("ISL");
    expect(detectStationCode("Alarm til ISL: Bygningsbrand")) .toBe("ISL");
    expect(detectStationCode("isl - assistance")) .toBe("ISL");
  });

  it("kræver stadig parenteser omkring de korte stationskoder", () => {
    expect(detectStationCode("(A) Bygningsbrand")) .toBe("A");
    expect(detectStationCode("A Bygningsbrand")) .toBeNull();
  });

  it("genkender ikke ISL som del af et andet ord", () => {
    expect(detectStationCode("En synlig melding")) .toBeNull();
  });
});
