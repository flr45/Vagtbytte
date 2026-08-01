"use client";

import { useActionState } from "react";
import {
  saveEmailReportScheduleAction,
  sendEmailReportNowAction
} from "@/lib/email-report-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export type EmailReportScheduleView = {
  name: string;
  enabled: boolean;
  recipients: string[];
  daysOfMonth: number[];
  sendHour: number;
  sendMinute: number;
};

export function EmailReportSettingsForm({
  schedule,
  smtpConfigured
}: {
  schedule: EmailReportScheduleView;
  smtpConfigured: boolean;
}) {
  const [state, action] = useActionState(saveEmailReportScheduleAction, {});

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-brand-line bg-white p-5">
      <div>
        <h2 className="text-xl font-black">Planlæg samlet vagtoversigt</h2>
        <p className="mt-1 text-sm font-semibold text-zinc-600">
          Mailen indeholder vagtbytter, tildelte vagter og fjernede tildelinger siden sidste rapport.
        </p>
      </div>

      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Rapportens navn
        <input
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
          defaultValue={schedule.name}
          name="name"
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Modtagere
        <textarea
          className="focus-ring min-h-28 rounded-xl border border-zinc-200 p-4 text-base"
          defaultValue={schedule.recipients.join("\n")}
          name="recipients"
          placeholder="mail@eksempel.dk\nanden@eksempel.dk"
          required
        />
        <span className="text-xs font-semibold text-zinc-500">Én eller flere mailadresser, adskilt med linjeskift eller komma.</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-zinc-700">
          Dage i måneden
          <input
            className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
            defaultValue={schedule.daysOfMonth.join(", ")}
            name="daysOfMonth"
            placeholder="1, 15, 28"
            required
          />
          <span className="text-xs font-semibold text-zinc-500">
            Eksempel: 1, 15 og 28 sender tre gange om måneden. Dag 31 bliver månedens sidste dag i korte måneder.
          </span>
        </label>

        <label className="grid gap-2 text-sm font-bold text-zinc-700">
          Tidspunkt
          <input
            className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
            defaultValue={`${String(schedule.sendHour).padStart(2, "0")}:${String(schedule.sendMinute).padStart(2, "0")}`}
            name="sendTime"
            required
            type="time"
          />
          <span className="text-xs font-semibold text-zinc-500">Dansk tid.</span>
        </label>
      </div>

      <label className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 font-bold">
        <input defaultChecked={schedule.enabled} name="enabled" type="checkbox" />
        Aktivér automatisk afsendelse
      </label>

      {!smtpConfigured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          SMTP er ikke konfigureret på serveren endnu. Indstillingerne kan gemmes, men mails kan først sendes, når SMTP-oplysningerne er tilføjet.
        </div>
      ) : null}

      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Gemmer…">Gem mailplan</SubmitButton>
    </form>
  );
}

export function SendEmailReportNowForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(sendEmailReportNowAction, {});

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
      onSubmit={(event) => {
        if (!window.confirm("Vil du sende den samlede vagtoversigt nu?")) event.preventDefault();
      }}
    >
      <div>
        <h2 className="text-lg font-black">Send rapport nu</h2>
        <p className="mt-1 text-sm font-semibold text-zinc-600">
          Rapporten dækker perioden siden den seneste vellykkede afsendelse. Første rapport starter ved månedens begyndelse.
        </p>
      </div>
      <ActionMessage message={state.message} ok={state.ok} />
      <button className="app-button-secondary" disabled={disabled} type="submit">
        Send samlet vagtoversigt nu
      </button>
    </form>
  );
}
