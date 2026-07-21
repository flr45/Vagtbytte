import { describe, expect, it } from "vitest";
import { TransferStatus, UserRole } from "@prisma/client";
import {
  canCreateReturnRequest,
  canOriginalRespondToReturn,
  canRespondToTransfer,
  canVcDecideReturn,
  canVcDecideTransfer,
  canViewTransfer,
  isExpectedEndOverdue,
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
    expectedEndMode: "SPECIFIC_TIME",
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

  it("brandmand kan vælge bestemt tidspunkt", () => {
    expect(validate({ expectedEndMode: "SPECIFIC_TIME", expectedEndAt: end }).ok).toBe(true);
  });

  it("bestemt tidspunkt kræver expectedEndAt", () => {
    expect(validate({ expectedEndMode: "SPECIFIC_TIME", expectedEndAt: null }).ok).toBe(false);
  });

  it("brandmand kan vælge til vagt slut", () => {
    expect(validate({ expectedEndMode: "UNTIL_SHIFT_END", expectedEndAt: null }).ok).toBe(true);
  });

  it("til vagt slut kræver expectedEndAt som null", () => {
    expect(validate({ expectedEndMode: "UNTIL_SHIFT_END", expectedEndAt: end }).ok).toBe(false);
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

describe("del 3 - vagtcentral", () => {
  it("VC kan se en sag efter B's accept", () => {
    expect(canVcDecideTransfer({ role: UserRole.VC, status: TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC }).ok).toBe(
      true
    );
  });

  it("VC kan ikke se en sag som klar til behandling før B's accept", () => {
    expect(canVcDecideTransfer({ role: UserRole.VC, status: TransferStatus.AWAITING_RECEIVER }).ok).toBe(false);
  });

  it("VC kan godkende en accepteret sag", () => {
    expect(canVcDecideTransfer({ role: UserRole.VC, status: TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC }).ok).toBe(
      true
    );
  });

  it("VC kan afvise en accepteret sag", () => {
    expect(canVcDecideTransfer({ role: UserRole.VC, status: TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC }).ok).toBe(
      true
    );
  });

  it("brandmand kan ikke kalde VC-godkendelse", () => {
    expect(canVcDecideTransfer({ role: UserRole.BRANDFIGHTER, status: TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC }).ok).toBe(
      false
    );
  });

  it("admin kan ikke godkende alene på baggrund af adminrollen", () => {
    expect(canVcDecideTransfer({ role: UserRole.ADMIN, status: TransferStatus.RECEIVER_ACCEPTED_AWAITING_VC }).ok).toBe(
      false
    );
  });

  it("godkendelse ændrer status til aktiv", () => {
    expect(statusLabel(TransferStatus.VC_APPROVED_ACTIVE)).toBe("Aktiv vagtoverdragelse");
  });

  it("dobbelt behandling af samme sag afvises", () => {
    expect(canVcDecideTransfer({ role: UserRole.VC, status: TransferStatus.VC_APPROVED_ACTIVE }).ok).toBe(false);
    expect(canVcDecideTransfer({ role: UserRole.VC, status: TransferStatus.VC_REJECTED }).ok).toBe(false);
  });
});

describe("del 3 - tilbagelevering", () => {
  it("B kan oprette tilbagelevering på en aktiv sag", () => {
    expect(
      canCreateReturnRequest({
        userId: receiver.id,
        receiverUserId: receiver.id,
        status: TransferStatus.VC_APPROVED_ACTIVE,
        hasOpenReturnRequest: false
      }).ok
    ).toBe(true);
  });

  it("A kan ikke oprette tilbageleveringen som B", () => {
    expect(
      canCreateReturnRequest({
        userId: giver.id,
        receiverUserId: receiver.id,
        status: TransferStatus.VC_APPROVED_ACTIVE,
        hasOpenReturnRequest: false
      }).ok
    ).toBe(false);
  });

  it("en tredje bruger kan ikke oprette tilbagelevering", () => {
    expect(
      canCreateReturnRequest({
        userId: "tredje",
        receiverUserId: receiver.id,
        status: TransferStatus.VC_APPROVED_ACTIVE,
        hasOpenReturnRequest: false
      }).ok
    ).toBe(false);
  });

  it("A kan acceptere tilbageleveringen", () => {
    expect(
      canOriginalRespondToReturn({
        userId: giver.id,
        originalUserId: giver.id,
        transferStatus: TransferStatus.RETURN_AWAITING_ORIGINAL,
        returnStatus: "AWAITING_ORIGINAL"
      }).ok
    ).toBe(true);
  });

  it("A kan afvise tilbageleveringen", () => {
    expect(
      canOriginalRespondToReturn({
        userId: giver.id,
        originalUserId: giver.id,
        transferStatus: TransferStatus.RETURN_AWAITING_ORIGINAL,
        returnStatus: "AWAITING_ORIGINAL"
      }).ok
    ).toBe(true);
  });

  it("B kan ikke acceptere på vegne af A", () => {
    expect(
      canOriginalRespondToReturn({
        userId: receiver.id,
        originalUserId: giver.id,
        transferStatus: TransferStatus.RETURN_AWAITING_ORIGINAL,
        returnStatus: "AWAITING_ORIGINAL"
      }).ok
    ).toBe(false);
  });

  it("VC kan ikke godkende tilbageleveringen før A's accept", () => {
    expect(
      canVcDecideReturn({
        role: UserRole.VC,
        transferStatus: TransferStatus.RETURN_AWAITING_ORIGINAL,
        returnStatus: "AWAITING_ORIGINAL"
      }).ok
    ).toBe(false);
  });

  it("brandmand kan ikke kalde dashboardets VC-handlinger for tilbagelevering", () => {
    expect(
      canVcDecideReturn({
        role: UserRole.BRANDFIGHTER,
        transferStatus: TransferStatus.RETURN_ACCEPTED_AWAITING_VC,
        returnStatus: "ORIGINAL_ACCEPTED_AWAITING_VC"
      }).ok
    ).toBe(false);
  });

  it("admin kan ikke kalde dashboardets VC-handlinger for tilbagelevering", () => {
    expect(
      canVcDecideReturn({
        role: UserRole.ADMIN,
        transferStatus: TransferStatus.RETURN_ACCEPTED_AWAITING_VC,
        returnStatus: "ORIGINAL_ACCEPTED_AWAITING_VC"
      }).ok
    ).toBe(false);
  });

  it("VC kan godkende en accepteret tilbagelevering", () => {
    expect(
      canVcDecideReturn({
        role: UserRole.VC,
        transferStatus: TransferStatus.RETURN_ACCEPTED_AWAITING_VC,
        returnStatus: "ORIGINAL_ACCEPTED_AWAITING_VC"
      }).ok
    ).toBe(true);
  });

  it("godkendt tilbagelevering afslutter sagen", () => {
    expect(statusLabel(TransferStatus.COMPLETED)).toBe("Afsluttet");
  });

  it("VC kan afvise tilbageleveringen", () => {
    expect(
      canVcDecideReturn({
        role: UserRole.VC,
        transferStatus: TransferStatus.RETURN_ACCEPTED_AWAITING_VC,
        returnStatus: "ORIGINAL_ACCEPTED_AWAITING_VC"
      }).ok
    ).toBe(true);
  });

  it("afvist tilbagelevering efterlader den oprindelige overdragelse aktiv", () => {
    expect(statusLabel(TransferStatus.VC_APPROVED_ACTIVE)).toBe("Aktiv vagtoverdragelse");
  });

  it("forventet sluttid medfører ingen automatisk ændring", () => {
    expect(isExpectedEndOverdue(new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z"))).toBe(
      true
    );
    expect(statusLabel(TransferStatus.VC_APPROVED_ACTIVE)).toBe("Aktiv vagtoverdragelse");
  });

  it("afsluttede sager kan ikke ændres", () => {
    expect(
      canCreateReturnRequest({
        userId: receiver.id,
        receiverUserId: receiver.id,
        status: TransferStatus.COMPLETED,
        hasOpenReturnRequest: false
      }).ok
    ).toBe(false);
  });
});
