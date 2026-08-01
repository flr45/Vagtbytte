import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  availabilityStatusLabel,
  calculateAssignedShiftWindow,
  calculateAvailabilityUntil,
  canAcknowledgeAvailability,
  canAssignAvailability,
  canCancelAvailability,
  canCreateAvailability,
  isCurrentAvailabilityAssignment
} from "./availability";

describe("til rådighed", () => {
  it("beregner næste vagtskifte automatisk", () => {
    expect(calculateAvailabilityUntil(new Date("2026-07-21T06:30:00.000Z")).toISOString()).toBe(
      "2026-07-21T13:00:00.000Z"
    );
    expect(calculateAvailabilityUntil(new Date("2026-07-21T16:30:00.000Z")).toISOString()).toBe(
      "2026-07-21T21:00:00.000Z"
    );
    expect(calculateAvailabilityUntil(new Date("2026-07-21T21:45:00.000Z")).toISOString()).toBe(
      "2026-07-22T05:00:00.000Z"
    );
  });

  it("tillader kun én aktiv tilgængelighed pr. brandmand", () => {
    expect(canCreateAvailability({ role: UserRole.BRANDFIGHTER, existingActiveAvailability: null }).ok).toBe(true);
    expect(
      canCreateAvailability({ role: UserRole.BRANDFIGHTER, existingActiveAvailability: { id: "active" } })
    ).toMatchObject({ ok: false, message: "Du er allerede til rådighed." });
  });

  it("afviser andre roller ved oprettelse, annullering, tildeling og bekræftelse", () => {
    expect(canCreateAvailability({ role: UserRole.VC, existingActiveAvailability: null }).ok).toBe(false);
    expect(
      canCancelAvailability({
        role: UserRole.ADMIN,
        currentUserId: "u1",
        availability: { userId: "u1", status: "AVAILABLE" }
      }).ok
    ).toBe(false);
    expect(canAssignAvailability({ role: UserRole.BRANDFIGHTER, availability: { status: "AVAILABLE" } }).ok).toBe(
      false
    );
    expect(
      canAcknowledgeAvailability({
        role: UserRole.VC,
        currentUserId: "u1",
        availability: { userId: "u1", status: "ASSIGNED" }
      }).ok
    ).toBe(false);
  });

  it("annullering kræver egen aktiv tilgængelighed", () => {
    expect(
      canCancelAvailability({
        role: UserRole.BRANDFIGHTER,
        currentUserId: "u1",
        availability: { userId: "u1", status: "AVAILABLE" }
      }).ok
    ).toBe(true);
    expect(
      canCancelAvailability({
        role: UserRole.BRANDFIGHTER,
        currentUserId: "u2",
        availability: { userId: "u1", status: "AVAILABLE" }
      }).ok
    ).toBe(false);
    expect(
      canCancelAvailability({
        role: UserRole.BRANDFIGHTER,
        currentUserId: "u1",
        availability: { userId: "u1", status: "ASSIGNED" }
      }).ok
    ).toBe(false);
  });

  it("VC kan kun tildele AVAILABLE", () => {
    expect(canAssignAvailability({ role: UserRole.VC, availability: { status: "AVAILABLE" } }).ok).toBe(true);
    expect(canAssignAvailability({ role: UserRole.VC, availability: { status: "ASSIGNED" } }).ok).toBe(false);
  });

  it("brandmand kan kun bekræfte egen ASSIGNED tildeling", () => {
    expect(
      canAcknowledgeAvailability({
        role: UserRole.BRANDFIGHTER,
        currentUserId: "u1",
        availability: { userId: "u1", status: "ASSIGNED" }
      }).ok
    ).toBe(true);
    expect(
      canAcknowledgeAvailability({
        role: UserRole.BRANDFIGHTER,
        currentUserId: "u2",
        availability: { userId: "u1", status: "ASSIGNED" }
      }).ok
    ).toBe(false);
    expect(
      canAcknowledgeAvailability({
        role: UserRole.BRANDFIGHTER,
        currentUserId: "u1",
        availability: { userId: "u1", status: "ACKNOWLEDGED" }
      }).ok
    ).toBe(false);
  });

  it("viser ingen tekniske statusnavne", () => {
    expect(availabilityStatusLabel("AVAILABLE")).toBe("Til rådighed");
    expect(availabilityStatusLabel("ACKNOWLEDGED")).toBe("Tildelt");
  });

  it("viser kun aktuelle tildelinger i det nuværende tidsrum", () => {
    const now = new Date("2026-07-21T18:00:00.000Z");
    const shift = calculateAssignedShiftWindow(now);
    expect(
      isCurrentAvailabilityAssignment(
        {
          status: "ASSIGNED",
          availableFrom: new Date("2026-07-21T17:00:00.000Z"),
          availableUntil: new Date("2026-07-21T21:00:00.000Z"),
          assignedShiftStart: shift.start,
          assignedShiftEnd: shift.end
        },
        now
      )
    ).toBe(true);
    expect(
      isCurrentAvailabilityAssignment(
        {
          status: "ACKNOWLEDGED",
          availableFrom: new Date("2026-07-21T17:00:00.000Z"),
          availableUntil: new Date("2026-07-21T21:00:00.000Z"),
          assignedShiftStart: shift.start,
          assignedShiftEnd: shift.end
        },
        now
      )
    ).toBe(true);
    expect(
      isCurrentAvailabilityAssignment(
        {
          status: "ASSIGNED",
          availableFrom: new Date("2026-07-21T17:00:00.000Z"),
          availableUntil: new Date("2026-07-21T21:00:00.000Z"),
          assignedShiftStart: shift.start,
          assignedShiftEnd: shift.end
        },
        new Date("2026-07-21T21:00:00.000Z")
      )
    ).toBe(false);
  });

  it("beregner tildelingens vagttidsrum", () => {
    const shift = calculateAssignedShiftWindow(new Date("2026-07-21T16:42:00.000Z"));

    expect(shift.start.toISOString()).toBe("2026-07-21T13:00:00.000Z");
    expect(shift.end.toISOString()).toBe("2026-07-21T21:00:00.000Z");
  });
});
