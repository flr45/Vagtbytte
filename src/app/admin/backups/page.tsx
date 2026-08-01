import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ManualBackupForm, RestoreBackupForm } from "@/components/BackupControls";
import { TopBar } from "@/components/TopBar";
import { formatDateTime } from "@/components/TransferSummary";
import { requireRole } from "@/lib/auth";
import {
  getBackupEncryptionStatus,
  isEncryptedBackupFileName
} from "@/lib/backup-encryption-status";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  await requireRole(UserRole.ADMIN);
  const [backups, latestAutomatic, encryptionStatus] = await Promise.all([
    prisma.backupSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.backupSnapshot.findFirst({
      where: { kind: "AUTOMATIC", status: "READY" },
      orderBy: { createdAt: "desc" }
    }),
    getBackupEncryptionStatus()
  ]);
  const legacyCount = backups.filter(
    (backup) => backup.status === "READY" && !isEncryptedBackupFileName(backup.fileName)
  ).length;

  return (
    <>
      <TopBar title="Backup og gendannelse" />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/admin">
          Tilbage til administration
        </Link>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">Backup og gendannelse</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-600">
            Der oprettes automatisk en backup hver nat omkring kl. 03.00. De 30 seneste automatiske backups bevares.
          </p>

          <div
            className={`mt-4 rounded-lg border p-4 ${
              encryptionStatus.configured
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-300 bg-red-50"
            }`}
            role={encryptionStatus.configured ? undefined : "alert"}
          >
            <p className={`text-sm font-black ${encryptionStatus.configured ? "text-emerald-900" : "text-red-950"}`}>
              Backupkryptering: {encryptionStatus.configured ? "Aktiv" : "Kræver handling"}
            </p>
            <p className={`mt-1 text-sm font-semibold ${encryptionStatus.configured ? "text-emerald-800" : "text-red-900"}`}>
              {encryptionStatus.message}
            </p>
            <p className={`mt-2 text-xs font-semibold ${encryptionStatus.configured ? "text-emerald-700" : "text-red-800"}`}>
              Nye backups oprettes kun i det autentificerede AES-256-GCM-format. Uden en gyldig nøgle fejler backupen sikkert i stedet for at gemme data ukrypteret.
            </p>
          </div>

          {legacyCount > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="font-black text-amber-950">{legacyCount} ældre ukrypteret backup{legacyCount === 1 ? "" : "s"}</p>
              <p className="mt-1 text-sm font-semibold text-amber-900">
                De kan fortsat gendannes, men bør slettes fra alle lagringssteder, når den første krypterede backup er kontrolleret og gemt sikkert.
              </p>
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-bold text-zinc-600">Seneste automatiske backup</p>
            <p className="mt-1 text-lg font-black">
              {latestAutomatic ? formatDateTime(latestAutomatic.createdAt) : "Ingen automatisk backup endnu"}
            </p>
            {latestAutomatic ? (
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                {formatBytes(latestAutomatic.sizeBytes)} · {isEncryptedBackupFileName(latestAutomatic.fileName) ? "krypteret" : "ældre ukrypteret"} · kontrolsum {latestAutomatic.sha256?.slice(0, 12) ?? "ukendt"}
              </p>
            ) : null}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <ManualBackupForm disabled={!encryptionStatus.configured} />
          <RestoreBackupForm />
        </div>

        <section className="overflow-hidden rounded-lg border border-brand-line bg-white">
          <div className="border-b border-brand-line p-4">
            <h2 className="text-xl font-black">Seneste backups</h2>
          </div>
          {backups.length === 0 ? (
            <p className="p-5 text-sm font-semibold text-zinc-600">Der er ikke oprettet backups endnu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Tidspunkt</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Beskyttelse</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Størrelse</th>
                    <th className="px-4 py-3">Fil</th>
                    <th className="px-4 py-3">Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => {
                    const encrypted = isEncryptedBackupFileName(backup.fileName);
                    return (
                      <tr className="border-t border-zinc-100" key={backup.id}>
                        <td className="px-4 py-3 font-semibold">{formatDateTime(backup.createdAt)}</td>
                        <td className="px-4 py-3">{backup.kind === "AUTOMATIC" ? "Automatisk" : "Manuel"}</td>
                        <td className="px-4 py-3">
                          <span className={encrypted ? "font-bold text-emerald-700" : "font-bold text-amber-800"}>
                            {encrypted ? "AES-256-GCM" : "Ældre ukrypteret"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={backup.status === "READY" ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
                            {backup.status === "READY" ? "Klar" : "Fejlet"}
                          </span>
                          {backup.errorMessage ? <p className="mt-1 max-w-sm break-words text-xs text-red-700">{backup.errorMessage}</p> : null}
                        </td>
                        <td className="px-4 py-3">{formatBytes(backup.sizeBytes)}</td>
                        <td className="max-w-xs break-all px-4 py-3 text-xs">{backup.fileName}</td>
                        <td className="px-4 py-3">
                          {backup.status === "READY" ? (
                            <a className="app-button-secondary min-h-10 px-3 text-sm" href={`/api/admin/backups/${backup.id}`}>
                              Hent
                            </a>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
