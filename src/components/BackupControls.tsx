"use client";

import { useActionState, useState } from "react";
import { createManualBackupAction } from "@/lib/backup-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function ManualBackupForm() {
  const [state, action] = useActionState(createManualBackupAction, {});

  return (
    <form action={action} className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <h2 className="text-lg font-black">Opret manuel backup</h2>
        <p className="mt-1 text-sm font-semibold text-zinc-600">
          Backupen indeholder brugere, stationer, alarmer, statistik, vagter, vagtbytter og indstillinger.
        </p>
      </div>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Opretter backup…">Opret backup nu</SubmitButton>
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
        <h2 className="text-lg font-black text-red-950">Gendan fra backup</h2>
        <p className="mt-1 text-sm font-semibold text-red-900">
          Alle nuværende Vagtbytte-data erstattes af indholdet i backupfilen. Aktive login-sessioner slettes.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-bold text-red-950">
        Vagtbytte-backupfil
        <input
          accept=".gz,.vagtbackup.gz,application/gzip"
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
        {busy ? "Gendanner…" : "Gendan backup"}
      </button>
    </form>
  );
}
