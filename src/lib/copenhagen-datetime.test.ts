import { describe, expect, it } from "vitest";
import { calculateCopenhagenShiftEnd, parseCopenhagenDateTimeLocal } from "./copenhagen-datetime";
import { formatDateTime } from "@/components/TransferSummary";
import { transferCreateSchema, returnRequestCreateSchema } from "./validation";

describe("datetime-local i dansk tid", () => {
  it("21. juli kl. 16.35 gemmes som korrekt UTC og vises som 16.35 dansk tid", () => {
    const date = parseCopenhagenDateTimeLocal("2026-07-21T16:35");

    expect(date.toISOString()).toBe("2026-07-21T14:35:00.000Z");
    expect(formatDateTime(date)).toContain("16.35");
  });

  it("21. januar kl. 16.35 gemmes som korrekt UTC og vises som 16.35 dansk tid", () => {
    const date = parseCopenhagenDateTimeLocal("2026-01-21T16:35");

    expect(date.toISOString()).toBe("2026-01-21T15:35:00.000Z");
    expect(formatDateTime(date)).toContain("16.35");
  });

  it("håndterer tidspunkt lige over midnat", () => {
    const date = parseCopenhagenDateTimeLocal("2026-07-22T00:05");

    expect(date.toISOString()).toBe("2026-07-21T22:05:00.000Z");
    expect(formatDateTime(date)).toContain("00.05");
  });

  it("sammenligner expectedEndAt korrekt med requestedStartAt", () => {
    const result = transferCreateSchema.safeParse({
      giverEmployeeNumber: "1001",
      receiverEmployeeNumber: "1002",
      requestedStartAt: "2026-07-21T16:35",
      expectedEndMode: "SPECIFIC_TIME",
      expectedEndAt: "2026-07-21T16:36",
      comment: "",
      confirmed: true
    });

    expect(result.success).toBe(true);
  });

  it("requestedReturnAt behandles som dansk lokal tid", () => {
    const result = returnRequestCreateSchema.safeParse({
      transferId: "transfer-1",
      requestedReturnAt: "2026-07-21T16:35",
      comment: ""
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.requestedReturnAt.toISOString() : "").toBe("2026-07-21T14:35:00.000Z");
  });

  it("ugyldigt datetime-local-format afvises", () => {
    expect(() => parseCopenhagenDateTimeLocal("2026-07-21 16:35")).toThrow();
  });

  it("ikke-eksisterende tidspunkt ved skift til sommertid afvises", () => {
    expect(() => parseCopenhagenDateTimeLocal("2026-03-29T02:30")).toThrow("findes ikke");
  });
});

describe("faste vagtslut i dansk tid", () => {
  const cases = [
    ["2026-07-21T08:30", "2026-07-21T13:00:00.000Z"],
    ["2026-07-21T14:50", "2026-07-21T13:00:00.000Z"],
    ["2026-07-21T18:30", "2026-07-21T21:00:00.000Z"],
    ["2026-07-21T22:45", "2026-07-21T21:00:00.000Z"],
    ["2026-07-21T23:30", "2026-07-22T05:00:00.000Z"],
    ["2026-07-21T03:00", "2026-07-21T05:00:00.000Z"],
    ["2026-07-21T15:00", "2026-07-21T21:00:00.000Z"],
    ["2026-07-21T23:00", "2026-07-22T05:00:00.000Z"],
    ["2026-07-21T07:00", "2026-07-21T13:00:00.000Z"]
  ] as const;

  it.each(cases)("beregner vagtslut for %s", (input, expectedIso) => {
    expect(calculateCopenhagenShiftEnd(parseCopenhagenDateTimeLocal(input)).toISOString()).toBe(expectedIso);
  });

  it("håndterer vintertid", () => {
    expect(calculateCopenhagenShiftEnd(parseCopenhagenDateTimeLocal("2026-01-21T23:30")).toISOString()).toBe(
      "2026-01-22T06:00:00.000Z"
    );
  });
});
