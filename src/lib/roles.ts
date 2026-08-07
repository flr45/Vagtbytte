import type { UserRole } from "@prisma/client";

export const roleHome: Record<UserRole, string> = {
  BRANDFIGHTER: "/app",
  VC: "/app",
  ADMIN: "/app"
};
