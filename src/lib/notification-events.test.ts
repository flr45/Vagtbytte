import { describe, expect, it } from "vitest";
import { shouldScheduleExpectedEndNotification } from "./notification-rules";

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
