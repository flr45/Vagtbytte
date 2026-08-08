import { redirect } from "next/navigation";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";

export default async function OperativShortcutPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/skift-adgangskode");
  }

  redirect(canAccessOperationalPortal(user) ? "/admin/operativ-portal" : "/app");
}
