import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/components/TransferSummary";
import { isWebPushConfigured, isWorkerStale } from "./system-status";

describe("systemstatus", () => {
  it("viser worker som for gammel efter forventet interval", () => {
    expect(isWorkerStale(new Date("2026-07-21T10:00:00.000Z"), new Date("2026-07-21T10:03:01.000Z"))).toBe(true);
    expect(isWorkerStale(new Date("2026-07-21T10:01:30.000Z"), new Date("2026-07-21T10:03:00.000Z"))).toBe(false);
  });

  it("viser web-push som konfigureret uden at bruge private værdier i UI", () => {
    expect(
      isWebPushConfigured({
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public",
        VAPID_PRIVATE_KEY: "private",
        VAPID_SUBJECT: "mailto:test@example.dk"
      })
    ).toBe(true);
  });

  it("viser sommer- og vintertid i Europe/Copenhagen", () => {
    expect(formatDateTime(new Date("2026-07-21T10:00:00.000Z"))).toContain("12.00");
    expect(formatDateTime(new Date("2026-01-21T10:00:00.000Z"))).toContain("11.00");
  });
});
