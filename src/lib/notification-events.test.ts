import { describe, expect, it } from "vitest";
import {
  returnExecutionReminderInputs,
  shouldScheduleExpectedEndNotification,
  transferActivationReminderInputs
} from "./notification-rules";

describe("forventet tilbagelevering - notifikationer", () => {
  it("bestemt tidspunkt opretter forventet-sluttid-notifikationer", () => {
    expect(
      shouldScheduleExpectedEndNotification({
        expectedEndMode: "SPECIFIC_TIME",
        expectedEndAt: new Date("2026-07-21T17:00:00.000Z")
      })
    ).toBe(true);
  });

  it("til vagt slut opretter ingen forventet-sluttid-notifikation til VC", () => {
    expect(shouldScheduleExpectedEndNotification({ expectedEndMode: "UNTIL_SHIFT_END", expectedEndAt: null })).toBe(
      false
    );
  });

  it("til vagt slut opretter ingen forventet-sluttid-notifikation til A eller B", () => {
    expect(shouldScheduleExpectedEndNotification({ expectedEndMode: "UNTIL_SHIFT_END", expectedEndAt: null })).toBe(
      false
    );
  });
});

describe("operationelle VC-reminders", () => {
  it("opretter fem-minutters og start-reminder for kommende vagtskifte", () => {
    const reminders = transferActivationReminderInputs(
      { id: "transfer-1", requestedStartAt: new Date("2026-07-21T10:00:00.000Z") },
      "vc-1",
      new Date("2026-07-21T09:00:00.000Z")
    );

    expect(reminders).toHaveLength(2);
    expect(reminders[0]).toMatchObject({
      type: "TRANSFER_ACTIVATION_REMINDER",
      scheduledFor: new Date("2026-07-21T09:55:00.000Z"),
      publishNow: false,
      link: "/vagtcentral/sager/transfer-1"
    });
    expect(reminders[1].scheduledFor).toEqual(new Date("2026-07-21T10:00:00.000Z"));
  });

  it("opretter straks-reminder når vagtskiftet allerede burde være udført", () => {
    const reminders = transferActivationReminderInputs(
      { id: "transfer-1", requestedStartAt: new Date("2026-07-21T10:00:00.000Z") },
      "vc-1",
      new Date("2026-07-21T10:01:00.000Z")
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ scheduledFor: null, publishNow: true });
  });

  it("opretter reminders for tilbageleveringens udførelse", () => {
    const reminders = returnExecutionReminderInputs(
      { id: "transfer-1" },
      { id: "return-1", requestedReturnAt: new Date("2026-07-21T12:00:00.000Z") },
      "vc-1",
      new Date("2026-07-21T11:00:00.000Z")
    );

    expect(reminders).toHaveLength(2);
    expect(reminders[0]).toMatchObject({
      type: "RETURN_EXECUTION_REMINDER",
      returnRequestId: "return-1",
      scheduledFor: new Date("2026-07-21T11:55:00.000Z"),
      publishNow: false,
      link: "/vagtcentral/sager/transfer-1"
    });
  });
});
