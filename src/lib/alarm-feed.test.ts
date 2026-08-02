import { describe, expect, it } from "vitest";
import {
  alarmNotificationLink,
  alarmNotificationTitle,
  detectStationCode,
  followUpWindowStart,
  normalizeStationHint,
  shouldReceiveAlarmNotification,
  startsNewAlarm
} from "./alarm-feed";

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

describe("normalizeStationHint", () => {
  it("accepterer en gyldig station fra SMS-gatewayen", () => {
    expect(normalizeStationHint(" a ")).toBe("A");
    expect(normalizeStationHint("isl")).toBe("ISL");
  });

  it("afviser manglende og ukendte stationskoder", () => {
    expect(normalizeStationHint(null)).toBeNull();
    expect(normalizeStationHint("X")).toBeNull();
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

describe("opfølgende sendinger", () => {
  it("beregner matchvinduet ud fra importtidspunktet", () => {
    const now = new Date("2026-08-02T18:30:00.000Z");
    expect(followUpWindowStart(now, 10 * 60 * 1000).toISOString()).toBe(
      "2026-08-02T18:20:00.000Z"
    );
  });
});

describe("shouldReceiveAlarmNotification", () => {
  it("sender notifikation for primærmeldingen", () => {
    expect(shouldReceiveAlarmNotification(1)).toBe(true);
  });

  it("sender aldrig notifikation for sending 2 og senere", () => {
    expect(shouldReceiveAlarmNotification(2)).toBe(false);
    expect(shouldReceiveAlarmNotification(3)).toBe(false);
  });
});

describe("alarmnotifikationer", () => {
  it("viser stationsnavnet i stedet for stationskoden", () => {
    expect(alarmNotificationTitle(1, "A")).toBe("🚨 Ny alarm – Slagelse");
    expect(alarmNotificationTitle(2, "L")).toBe("🚨 Sending 2 – Skælskør");
  });

  it("linker direkte til den konkrete alarm", () => {
    expect(alarmNotificationLink("alarm 123")).toBe(
      "/brandmand/alarmer#alarm-alarm%20123"
    );
  });
});
