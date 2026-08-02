import { describe, expect, it } from "vitest";
import {
  alarmNotificationLink,
  alarmNotificationTitle,
  detectStationCode,
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

describe("shouldReceiveAlarmNotification", () => {
  it("sender altid første sending til brugere på stationen", () => {
    expect(shouldReceiveAlarmNotification(1, false)).toBe(true);
    expect(shouldReceiveAlarmNotification(1, true)).toBe(true);
  });

  it("sender kun sending 2 og senere til brugere, der er tilmeldt", () => {
    expect(shouldReceiveAlarmNotification(2, false)).toBe(false);
    expect(shouldReceiveAlarmNotification(2, true)).toBe(true);
    expect(shouldReceiveAlarmNotification(3, false)).toBe(false);
    expect(shouldReceiveAlarmNotification(3, true)).toBe(true);
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
