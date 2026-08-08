import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AlarmShortcutPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/skift-adgangskode");
  }

  redirect(user.role === "BRANDFIGHTER" ? "/brandmand/alarmer" : "/app");
}
