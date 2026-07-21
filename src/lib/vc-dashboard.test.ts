import { describe, expect, it } from "vitest";
import { NotificationType, TransferStatus } from "@prisma/client";
import {
  formatCountdown,
  formatShortCountdown,
  getVcDashboardStatus,
  getVcPriority,
  hasValidCaseLink,
  notificationTypeLabel,
  sortVcTasksByDeadline,
  type VcDashboardTask
} from "./vc-dashboard";

const now = new Date("2026-07-21T10:00:00.000Z");

describe("VC-dashboard - statusbjælke", () => {
  it("viser grøn status, når ingen VC-opgaver afventer", () => {
    expect(getVcDashboardStatus([], now)).toMatchObject({
      priority: "green",
      text: "Alle opgaver er ajour"
    });
  });

  it("viser grøn status, når nærmeste frist er mere end 15 minutter væk", () => {
    expect(getVcDashboardStatus([task({ deadlineAt: minutesFromNow(16) })], now).priority).toBe("green");
  });

  it("viser gul status fra og med 15 minutter før handling", () => {
    expect(getVcDashboardStatus([task({ deadlineAt: minutesFromNow(15) })], now).priority).toBe("yellow");
  });

  it("viser gul status 10 minutter før handling", () => {
    expect(getVcDashboardStatus([task({ deadlineAt: minutesFromNow(10) })], now).priority).toBe("yellow");
  });

  it("viser rød status, når nærmeste frist er mellem 1 og 5 minutter væk", () => {
    expect(getVcDashboardStatus([task({ deadlineAt: minutesFromNow(5) })], now).priority).toBe("red");
    expect(getVcDashboardStatus([task({ deadlineAt: minutesFromNow(2) })], now).priority).toBe("red");
  });

  it("viser blinkende rød status, når fristen er under 1 minut væk", () => {
    expect(getVcDashboardStatus([task({ deadlineAt: secondsFromNow(59) })], now).priority).toBe("critical");
  });

  it("viser blinkende rød status, når fristen er overskredet", () => {
    expect(getVcDashboardStatus([task({ deadlineAt: secondsFromNow(0) })], now).priority).toBe("critical");
    expect(getVcDashboardStatus([task({ deadlineAt: minutesFromNow(-10) })], now).priority).toBe("critical");
    expect(formatShortCountdown(secondsFromNow(0), now)).toBe("forsinket");
  });

  it("den mest kritiske opgave bestemmer bjælkens farve", () => {
    const status = getVcDashboardStatus(
      [task({ deadlineAt: minutesFromNow(20) }), task({ id: "critical", deadlineAt: secondsFromNow(30) })],
      now
    );

    expect(status.priority).toBe("critical");
  });

  it("aktive sager påvirker ikke bjælkens farve", () => {
    const status = getVcDashboardStatus(
      [task({ status: TransferStatus.VC_APPROVED_ACTIVE, deadlineAt: secondsFromNow(30) })],
      now
    );

    expect(status.priority).toBe("green");
  });

  it("til vagt slut påvirker ikke VC-statusbjælkens farve på baggrund af sluttid", () => {
    const status = getVcDashboardStatus([], now);

    expect(status.priority).toBe("green");
  });

  it("bestemt tidspunkt indgår i VC-statusbjælkens prioritering", () => {
    const status = getVcDashboardStatus(
      [task({ kind: "EXPECTED_END", status: TransferStatus.VC_APPROVED_ACTIVE, deadlineAt: minutesFromNow(4) })],
      now
    );

    expect(status.priority).toBe("red");
  });

  it("bestemt tidspunkt giver gul, rød og blinkende rød", () => {
    expect(
      getVcDashboardStatus(
        [task({ kind: "EXPECTED_END", status: TransferStatus.VC_APPROVED_ACTIVE, deadlineAt: minutesFromNow(10) })],
        now
      ).priority
    ).toBe("yellow");
    expect(
      getVcDashboardStatus(
        [task({ kind: "EXPECTED_END", status: TransferStatus.VC_APPROVED_ACTIVE, deadlineAt: minutesFromNow(3) })],
        now
      ).priority
    ).toBe("red");
    expect(
      getVcDashboardStatus(
        [task({ kind: "EXPECTED_END", status: TransferStatus.VC_APPROVED_ACTIVE, deadlineAt: secondsFromNow(45) })],
        now
      ).priority
    ).toBe("critical");
  });

  it("afsluttede sager påvirker ikke bjælkens farve", () => {
    const status = getVcDashboardStatus(
      [task({ status: TransferStatus.COMPLETED, deadlineAt: secondsFromNow(30) })],
      now
    );

    expect(status.priority).toBe("green");
  });

  it("manglende frist behandles som øjeblikkelig opgave", () => {
    expect(getVcPriority(null, now)).toBe("critical");
  });

  it("bjælken opdateres efter godkendelse", () => {
    const before = getVcDashboardStatus([task({ deadlineAt: minutesFromNow(4) })], now);
    const after = getVcDashboardStatus([], now);

    expect(before.priority).toBe("red");
    expect(after.priority).toBe("green");
  });

  it("bjælken opdateres efter afvisning", () => {
    const before = getVcDashboardStatus([task({ deadlineAt: minutesFromNow(15) })], now);
    const after = getVcDashboardStatus([], now);

    expect(before.priority).toBe("yellow");
    expect(after.priority).toBe("green");
  });
});

describe("VC-dashboard - opgaver", () => {
  it("almindelig overdragelse bruger requestedStartAt som frist", () => {
    const transfer = task({ kind: "TRANSFER", deadlineAt: minutesFromNow(10) });

    expect(transfer.deadlineAt).toEqual(new Date("2026-07-21T10:10:00.000Z"));
  });

  it("tilbagelevering bruger ønsket tilbageleveringstidspunkt", () => {
    const returnTask = task({
      kind: "RETURN",
      status: TransferStatus.RETURN_ACCEPTED_AWAITING_VC,
      deadlineAt: minutesFromNow(8)
    });

    expect(returnTask.deadlineAt).toEqual(new Date("2026-07-21T10:08:00.000Z"));
  });

  it("opgaver sorteres efter nærmeste frist", () => {
    const sorted = sortVcTasksByDeadline(
      [
        task({ id: "sen", deadlineAt: minutesFromNow(30) }),
        task({ id: "nu", deadlineAt: minutesFromNow(2) }),
        task({ id: "først", deadlineAt: minutesFromNow(-1) })
      ],
      now
    );

    expect(sorted.map((item) => item.id)).toEqual(["først", "nu", "sen"]);
  });

  it("live nedtælling bruger dansk tekst", () => {
    expect(formatCountdown(secondsFromNow(258), now)).toBe("Om 4 minutter og 18 sekunder");
    expect(formatCountdown(minutesFromNow(-2), now)).toBe("Overskredet med 2 minutter");
  });
});

describe("VC-dashboard - notifikationstekster", () => {
  it("tekniske notification enum-navne vises ikke i brugerfladen", () => {
    expect(notificationTypeLabel(NotificationType.TRANSFER_VC_APPROVED)).toBe("Godkendt af vagtcentralen");
    expect(notificationTypeLabel(NotificationType.AVAILABILITY_ASSIGNED)).toBe("Vagt tildelt");
    expect(notificationTypeLabel(NotificationType.TEST)).toBe("Testnotifikation");
  });

  it("Åbn sag vises ikke på en testnotifikation uden gyldigt link", () => {
    expect(hasValidCaseLink("/vagtcentral")).toBe(false);
    expect(hasValidCaseLink("/vagtcentral/sager/abc123")).toBe(true);
    expect(hasValidCaseLink("/brandmand/til-raadighed/abc123")).toBe(true);
  });
});

function task(overrides: Partial<VcDashboardTask> = {}): VcDashboardTask {
  return {
    id: "task",
    kind: "TRANSFER",
    transferId: "transfer",
    transferNumber: "VO-1",
    status: TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC,
    deadlineAt: minutesFromNow(10),
    awaitingSince: minutesFromNow(-5),
    ...overrides
  };
}

function minutesFromNow(minutes: number) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

function secondsFromNow(seconds: number) {
  return new Date(now.getTime() + seconds * 1000);
}
