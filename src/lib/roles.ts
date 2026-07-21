import type { UserRole } from "@prisma/client";

export const roleHome: Record<UserRole, string> = {
  BRANDFIGHTER: "/brandmand",
  VC: "/vagtcentral",
  ADMIN: "/admin"
};
