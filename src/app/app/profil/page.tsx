import { SbrFirePageFrame } from "@/components/SbrFireApp";
import { ProfileSettingsForms } from "@/components/ProfileSettingsForms";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SbrFireProfilePage() {
  const user = await requireUser();
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });

  return (
    <SbrFirePageFrame active="more" backHref="/app/mere" title="Profil">
      <section className="rounded-2xl border border-white/10 bg-[#0d1317] p-5 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Profil</p>
        <h1 className="mt-1 text-2xl font-black text-white">{user.name}</h1>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-400 sm:grid-cols-2">
          <p>Rolle: <strong className="text-white">{roleLabel(user.role)}</strong></p>
          <p>Medarbejdernummer: <strong className="text-white">{user.employeeNumber ?? "—"}</strong></p>
        </div>
      </section>

      <ProfileSettingsForms name={user.name} email={account?.email ?? null} />
    </SbrFirePageFrame>
  );
}

function roleLabel(role: string) {
  if (role === "BRANDFIGHTER") return "Brandmand";
  if (role === "VC") return "Vagtcentral";
  return "Administrator";
}
