import { UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { CreateFirefighterForm, FirefighterEditForms, VcForm } from "@/components/AdminForms";
import { formatDateTime } from "@/components/TransferSummary";

function roleLabel(role: UserRole) {
  if (role === UserRole.BRANDFIGHTER) return "Brandmand";
  if (role === UserRole.VC) return "Vagtcentral";
  return "Admin";
}

export default async function AdminPage() {
  await requireRole(UserRole.ADMIN);

  const [users, vc, auditLogs] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        employeeNumber: true,
        loginIdentifier: true,
        isActive: true,
        updatedAt: true
      }
    }),
    prisma.user.findFirst({
      where: { role: UserRole.VC },
      select: { loginIdentifier: true, isActive: true }
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, description: true, createdAt: true }
    })
  ]);

  const firefighters = users.filter((user) => user.role === UserRole.BRANDFIGHTER);

  return (
    <>
      <TopBar title="Administration" />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        <section>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="mt-2 text-base text-zinc-700">
            Administrer brandmænd og vagtcentralens fælles login.
          </p>
          <Link
            className="focus-ring mt-4 inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 font-semibold text-zinc-900"
            href="/admin/systemstatus"
          >
            Se systemstatus
          </Link>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <h2 className="text-xl font-bold">Brugere</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-line text-zinc-600">
                  <th className="py-3 pr-4 font-semibold">Navn</th>
                  <th className="py-3 pr-4 font-semibold">Medarbejdernummer</th>
                  <th className="py-3 pr-4 font-semibold">Rolle</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold">Senest ændret</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-100">
                    <td className="py-3 pr-4 font-semibold">{user.name}</td>
                    <td className="py-3 pr-4">{user.employeeNumber ?? "-"}</td>
                    <td className="py-3 pr-4">{roleLabel(user.role)}</td>
                    <td className="py-3 pr-4">{user.isActive ? "Aktiv" : "Deaktiveret"}</td>
                    <td className="py-3 pr-4">
                      {formatDateTime(user.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="grid gap-4">
            <h2 className="text-xl font-bold">Rediger brandmænd</h2>
            <FirefighterEditForms users={firefighters} />
          </section>
          <aside className="grid content-start gap-6">
            <CreateFirefighterForm />
            <VcForm vc={vc} />
            <section className="rounded-lg border border-brand-line bg-white p-4">
              <h2 className="text-xl font-bold">Revisionslog</h2>
              <div className="mt-4 grid gap-3">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-zinc-600">Ingen handlinger er logget endnu.</p>
                ) : (
                  auditLogs.map((log) => (
                    <article key={log.id} className="border-b border-zinc-100 pb-3">
                      <p className="text-sm font-bold">{log.action}</p>
                      <p className="mt-1 text-sm text-zinc-700">{log.description}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDateTime(log.createdAt)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
