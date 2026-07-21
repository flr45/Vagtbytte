import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  actorLabel,
  canReadCaseHistory,
  caseHistoryWhere,
  formatCaseHistoryAction,
  visibleCaseHistoryEntries
} from "./case-history";

describe("sagshistorik", () => {
  it("brandmand kan kun læse historik for egne sager", () => {
    expect(
      canReadCaseHistory({
        userId: "a",
        role: UserRole.BRANDFIGHTER,
        giverUserId: "a",
        receiverUserId: "b"
      })
    ).toBe(true);
    expect(
      canReadCaseHistory({
        userId: "c",
        role: UserRole.BRANDFIGHTER,
        giverUserId: "a",
        receiverUserId: "b"
      })
    ).toBe(false);
  });

  it("VC kan læse sagshistorik i VC-visningen", () => {
    expect(
      canReadCaseHistory({
        userId: "vc",
        role: UserRole.VC,
        giverUserId: "a",
        receiverUserId: "b"
      })
    ).toBe(true);
  });

  it("filtrerer på aktuel sag med shiftTransferId", () => {
    expect(caseHistoryWhere("transfer-1")).toEqual({ shiftTransferId: "transfer-1" });
  });

  it("viser kun kendte, forståelige handlinger og sorterer ældst først", () => {
    const entries = visibleCaseHistoryEntries([
      {
        action: "TECHNICAL_ENUM_SHOULD_NOT_SHOW",
        actorRole: UserRole.ADMIN,
        actor: null,
        createdAt: new Date("2026-07-21T10:02:00.000Z")
      },
      {
        action: "TRANSFER_VC_APPROVED",
        actorRole: UserRole.VC,
        actor: { name: "Vagtcentralen", role: UserRole.VC },
        createdAt: new Date("2026-07-21T10:01:00.000Z")
      },
      {
        action: "TRANSFER_CREATED",
        actorRole: UserRole.BRANDFIGHTER,
        actor: { name: "Frederik Racher", role: UserRole.BRANDFIGHTER },
        createdAt: new Date("2026-07-21T10:00:00.000Z")
      }
    ]);

    expect(entries.map((entry) => entry.action)).toEqual([
      "Oprettet",
      "VC godkendte"
    ]);
    expect(entries[0].actor).toBe("Frederik Racher");
  });

  it("viser ikke rå enum-navne", () => {
    expect(formatCaseHistoryAction("TRANSFER_CREATED")).toBe("Oprettet");
    expect(formatCaseHistoryAction("TRANSFER_CREATED")).not.toBe("TRANSFER_CREATED");
  });

  it("falder tilbage til rolle, hvis aktørnavn mangler", () => {
    expect(actorLabel({ actor: null, actorRole: UserRole.VC })).toBe("Vagtcentralen");
  });
});
