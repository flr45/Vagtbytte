"use client";

import { useActionState } from "react";
import { deleteAlarmAction } from "@/lib/alarm-admin-actions";
import { stationLabel } from "@/lib/stations";
import { ActionMessage } from "./ActionMessage";
import { formatDateTime } from "./TransferSummary";

type AdminAlarm = {
  id: string;
  stationCode: string | null;
  openedAt: string;
  messages: Array<{
    id: string;
    sequenceNumber: number;
    rawMessage: string;
    receivedAt: string;
  }>;
};

export function AdminAlarmManagement({ alarms }: { alarms: AdminAlarm[] }) {
  if (alarms.length === 0) {
    return <p className="text-sm text-zinc-600">Der er ingen alarmer gemt.</p>;
  }

  return (
    <div className="grid gap-3">
      {alarms.map((alarm) => (
        <AdminAlarmRow alarm={alarm} key={alarm.id} />
      ))}
    </div>
  );
}

function AdminAlarmRow({ alarm }: { alarm: AdminAlarm }) {
  const [state, action] = useActionState(deleteAlarmAction, {});
  const firstMessage = alarm.messages[0]?.rawMessage ?? "Ingen alarmtekst";

  return (
    <details className="rounded-lg border border-zinc-200 bg-zinc-50">
      <summary className="focus-ring cursor-pointer rounded-lg px-4 py-3">
        <span className="font-bold">{stationLabel(alarm.stationCode)}</span>
        <span className="ml-2 text-sm text-zinc-600">{formatDateTime(new Date(alarm.openedAt))}</span>
      </summary>
      <div className="grid gap-4 border-t border-zinc-200 bg-white p-4">
        <p className="whitespace-pre-wrap break-words text-sm font-semibold text-zinc-800">
          {firstMessage}
        </p>
        <p className="text-sm text-zinc-600">
          {alarm.messages.length} {alarm.messages.length === 1 ? "sending" : "sendinger"}
        </p>
        <form
          action={action}
          className="grid gap-3"
          onSubmit={(event) => {
            if (!window.confirm("Vil du slette denne alarm og alle dens sendinger?")) {
              event.preventDefault();
            }
          }}
        >
          <input name="alarmId" type="hidden" value={alarm.id} />
          <ActionMessage message={state.message} ok={state.ok} />
          <button className="app-button-danger w-full sm:w-fit" type="submit">
            Slet alarm
          </button>
        </form>
      </div>
    </details>
  );
}
