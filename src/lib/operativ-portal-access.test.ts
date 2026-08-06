import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  canAccessOperationalPortal,
  canManageOperationalPortal
} from "./operativ-portal-access";

const firefighter = {
  role: UserRole.BRANDFIGHTER,
  hasAdminAccess: false,
  hasOperationalPortalAccess: false
};

describe("Operativ Portal-adgang", () => {
  it("giver administratorer både læse- og redigeringsadgang", () => {
    const user = { ...firefighter, role: UserRole.ADMIN };
    expect(canAccessOperationalPortal(user)).toBe(true);
    expect(canManageOperationalPortal(user)).toBe(true);
  });

  it("giver brugere med administratoradgang både læse- og redigeringsadgang", () => {
    const user = { ...firefighter, hasAdminAccess: true };
    expect(canAccessOperationalPortal(user)).toBe(true);
    expect(canManageOperationalPortal(user)).toBe(true);
  });

  it("giver den nye tilladelse læseadgang uden redigeringsadgang", () => {
    const user = { ...firefighter, hasOperationalPortalAccess: true };
    expect(canAccessOperationalPortal(user)).toBe(true);
    expect(canManageOperationalPortal(user)).toBe(false);
  });

  it("afviser en brandmand uden tilladelse", () => {
    expect(canAccessOperationalPortal(firefighter)).toBe(false);
    expect(canManageOperationalPortal(firefighter)).toBe(false);
  });

  it("afviser en manglende bruger", () => {
    expect(canAccessOperationalPortal(null)).toBe(false);
    expect(canManageOperationalPortal(undefined)).toBe(false);
  });
});
