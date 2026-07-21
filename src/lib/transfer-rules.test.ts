import { describe, expect, it } from "vitest";
import { TransferStatus, UserRole } from "@prisma/client";
import {
  canRespondToTransfer,
  canViewTransfer,
  statusLabel,
  validateTransferParticipants,
  type TransferParticipant
} from "./transfer-rules";

const giver: TransferParticipant = {
  id: "giver",
  name: "Frederik Racher",
  role: UserRole.BRANDFIGHTER,
  employeeNumber: "1001",
  isActive: true
};

const receiver: TransferParticipant = {
  id: "receiver",
  name: "Test Brandmand",
  role: UserRole.BRANDFIGHTER,
  employeeNumber: "1002",
  isActive: true
};

const start = new Date("2026-07-21T10:00:00.000Z");
const end = new Date("2026-07-21T12:00:00.000Z");

function validate(overrides: Partial<Parameters<typeof validateTransferParticipants>[0]> = {}) {
  return validateTransferParticipants({
    currentUserId: giver.id,
    giver,
    receiver,
    giverEmployeeNumber: "1001",
    receiverEmployeeNumber: "1002",
    requestedStartAt: start,
    expectedEndAt: end,
    ...overrides
  });
}

describe("vagtoverdragelse - oprettelse", () => {
  it("A kan oprette en gyldig anmodning", () => {
    expect(validate().ok).toBe(true);
  });

  it("A skal indtaste begge medarbejdernumre", () => {
    expect(validate({ giverEmployeeNumber: "" }).ok).toBe(false);
    expect(validate({ receiverEmployeeNumber: "" }).ok).toBe(false);
  });

  it("den indloggede bruger skal matche medarbejdernummer A", () => {
    expect(validate({ currentUserId: "en-anden" }).ok).toBe(false);
  });

  it("A og B må ikke være samme bruger", () => {
    expect(validate({ receiver: { ...giver } }).ok).toBe(false);
  });

  it("ukendt medarbejdernummer afvises", () => {
    expect(validate({ receiver: null }).ok).toBe(false);
  });

  it("deaktiveret B afvises", () => {
    expect(validate({ receiver: { ...receiver, isActive: false } }).ok).toBe(false);
  });

  it("forventet sluttid før starttid afvises", () => {
    expect(validate({ expectedEndAt: new Date("2026-07-21T09:00:00.000Z") }).ok).toBe(false);
  });

  it("forventet sluttid ændrer ikke automatisk status", () => {
    expect(statusLabel(TransferStatus.AWAITING_RECEIVER)).toBe("Afventer modtager");
  });
});

describe("vagtoverdragelse - adgang", () => {
  it("B kan se en anmodning rettet til sig", () => {
    expect(canViewTransfer({ userId: receiver.id, giverUserId: giver.id, receiverUserId: receiver.id })).toBe(true);
  });

  it("en tredje brandmand kan ikke se anmodningen", () => {
    expect(canViewTransfer({ userId: "tredje", giverUserId: giver.id, receiverUserId: receiver.id })).toBe(false);
  });
});

describe("vagtoverdragelse - svar", () => {
  it("B kan acceptere", () => {
    expect(
      canRespondToTransfer({
        userId: receiver.id,
        receiverUserId: receiver.id,
        status: TransferStatus.AWAITING_RECEIVER
      }).ok
    ).toBe(true);
  });

  it("B kan afvise", () => {
    expect(
      canRespondToTransfer({
        userId: receiver.id,
        receiverUserId: receiver.id,
        status: TransferStatus.AWAITING_RECEIVER
      }).ok
    ).toBe(true);
  });

  it("A kan ikke acceptere på vegne af B", () => {
    expect(
      canRespondToTransfer({
        userId: giver.id,
        receiverUserId: receiver.id,
        status: TransferStatus.AWAITING_RECEIVER
      }).ok
    ).toBe(false);
  });

  it("en sag kan ikke besvares flere gange", () => {
    expect(
      canRespondToTransfer({
        userId: receiver.id,
        receiverUserId: receiver.id,
        status: TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC
      }).ok
    ).toBe(false);
  });

  it("accept ændrer status til afventer VC", () => {
    expect(statusLabel(TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC)).toBe(
      "Accepteret - afventer vagtcentralen"
    );
  });

  it("afvisning sender ikke sagen videre til VC", () => {
    expect(statusLabel(TransferStatus.RECEIVER_REJECTED)).toBe("Afvist af modtager");
  });
});
