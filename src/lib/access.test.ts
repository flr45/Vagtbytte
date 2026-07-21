import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { roleHome } from "./roles";

function canOpen(userRole: UserRole, path: string) {
  const requiredRoleByPath: Record<string, UserRole> = {
    "/brandmand": UserRole.BRANDFIGHTER,
    "/vagtcentral": UserRole.VC,
    "/admin": UserRole.ADMIN
  };

  return requiredRoleByPath[path] === userRole;
}

describe("rolle-adgang", () => {
  it("sender roller til de korrekte sider", () => {
    expect(roleHome.BRANDFIGHTER).toBe("/brandmand");
    expect(roleHome.VC).toBe("/vagtcentral");
    expect(roleHome.ADMIN).toBe("/admin");
  });

  it("brandmand kan ikke åbne admin eller vagtcentral", () => {
    expect(canOpen(UserRole.BRANDFIGHTER, "/admin")).toBe(false);
    expect(canOpen(UserRole.BRANDFIGHTER, "/vagtcentral")).toBe(false);
  });

  it("vc kan kun åbne vc-området", () => {
    expect(canOpen(UserRole.VC, "/vagtcentral")).toBe(true);
    expect(canOpen(UserRole.VC, "/admin")).toBe(false);
    expect(canOpen(UserRole.VC, "/brandmand")).toBe(false);
  });

  it("admin kan åbne administrationsområdet", () => {
    expect(canOpen(UserRole.ADMIN, "/admin")).toBe(true);
  });
});
