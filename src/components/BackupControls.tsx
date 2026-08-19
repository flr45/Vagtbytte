"use client";

import { useActionState, useState } from "react";
import { createManualBackupAction } from "@/lib/backup-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function ManualBackupForm({ disabled = false }: { disabled?: boolean }) {
  const [state, action] = useActionState(createManualBackupAction, {});

  return (
    <form action={action} className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <h2 className="text-lg font-black">Opret manuel backup</h2>
        <p className="mt-1 text-sm font-semibold text-zinc-600">
          Nye v2-backups indeholder bruger- og vagtdata samt hele Operativ Portal, inklusive billeder og dokumenter, i én krypteret pakke.
        </p>
      </div>
      {disabled ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">
          Opret en gyldig backupkrypteringsnøgle, før der kan oprettes nye backups.
        </p>
      ) : null}
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton disabled={disabled} pendingText="Krypterer backup…">Opret krypteret backup nu</SubmitButton>
    </form>
  );
}

export function RestoreBackupForm() {
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | undefined>();
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-4 rounded-lg border border-red-200 bg-red-50 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!window.confirm("Gendannelse erstatter de nuværende data. Vil du fortsætte?")) return;

        setBusy(true);
        setMessage("");
        setOk(undefined);
        try {
          const formData = new FormData(form);
          formData.set("confirmed", "yes");
          const response = await fetch("/api/admin/backups/restore", {
            method: "POST",
            body: formData
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Gendannelsen fejlede");
          setOk(true);
          setMessage(data.message ?? "Backupen er gendannet.");
          window.setTimeout(() => {
            window.location.href = "/login";
          }, 1800);
        } catch (error) {
          setOk(false);
          setMessage(error instanceof Error ? error.message : "Gendannelsen fejlede");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="text-lg font-black text-red-950">Gendan ekstern backupfil</h2>
        <p className="mt-1 text-sm font-semibold text-red-900">
          Brug denne vej til en backupfil, der ikke allerede ligger på serveren. Upload er begrænset til 100 MB for at beskytte webprocessens hukommelse. Større v2-backups bør gendannes direkte fra listen over gemte backups.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-bold text-red-950">
        SBR Portal-backupfil
        <input
          accept=".enc,.vagtbackup.enc,.gz,.vagtbackup.gz,application/octet-stream,application/gzip"
          className="focus-ring rounded-lg border border-red-200 bg-white p-3"
          name="backup"
          required
          type="file"
        />
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-red-200 bg-white p-3 text-sm font-bold text-red-950">
        <input className="mt-1" required type="checkbox" />
        Jeg forstår, at de nuværende data bliver erstattet.
      </label>
      <ActionMessage message={message} ok={ok} />
      <button className="app-button-danger" disabled={busy} type="submit">
        {busy ? "Dekrypterer og gendanner…" : "Gendan uploadet backup"}
      </button>
    </form>
  );
}

export function StoredBackupRestoreButton({ backupId }: { backupId: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="focus-ring min-h-10 rounded-md border border-red-200 px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Gendan denne backup? Nuværende data erstattes, og du bliver logget ud.")) return;
        setBusy(true);
        try {
          const response = await fetch(`/api/admin/backups/${backupId}/restore`, { method: "POST" });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Gendannelsen fejlede");
          window.alert(data.message ?? "Backupen er gendannet.");
          window.location.href = "/login";
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Gendannelsen fejlede");
          setBusy(false);
        }
      }}
      type="button"
    >
      {busy ? "Gendanner…" : "Gendan"}
    </button>
  );
}
