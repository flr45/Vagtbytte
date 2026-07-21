import { redirect } from "next/navigation";
import { getCurrentUser, roleHome } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/skift-adgangskode");
  }
  redirect(roleHome[user.role]);
}
