import { describe, expect, it } from "vitest";
import { isAlarmFollowUpNotification } from "./alarm-notification-policy";

describe("alarmnotifikationspolitik", () => {
  it("tillader primærmeldingen", () => {
    expect(
      isAlarmFollowUpNotification({
        type: "ALARM_MESSAGE",
        title: "🚨 Ny alarm – Slagelse"
      })
    ).toBe(false);
  });

  it("genkender sending 2 og senere som opfølgende notifikationer", () => {
    expect(
      isAlarmFollowUpNotification({
        type: "ALARM_MESSAGE",
        title: "🚨 Sending 2 – Slagelse"
      })
    ).toBe(true);
    expect(
      isAlarmFollowUpNotification({
        type: "ALARM_MESSAGE",
        title: "🚨 Sending 12 – Skælskør"
      })
    ).toBe(true);
  });

  it("påvirker ikke andre notifikationstyper", () => {
    expect(
      isAlarmFollowUpNotification({
        type: "TRANSFER_CREATED",
        title: "Sending 2"
      })
    ).toBe(false);
  });
});
