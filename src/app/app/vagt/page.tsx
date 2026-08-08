import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function VagtShortcutPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/skift-adgangskode");
  }

  if (user.role === "BRANDFIGHTER") {
    redirect("/brandmand");
  }
  if (user.role === "VC") {
    redirect("/vagtcentral");
  }

  redirect("/admin");
}
