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
    return <p className="text-sm text-zinc-600">Der er ingen alarmer, der matcher visningen.</p>;
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

  return (
    <details className="rounded-lg border border-zinc-200 bg-zinc-50">
      <summary className="focus-ring cursor-pointer rounded-lg px-4 py-3">
        <span className="font-bold">{stationLabel(alarm.stationCode)}</span>
        <span className="ml-2 text-sm text-zinc-600">{formatDateTime(new Date(alarm.openedAt))}</span>
        <span className="ml-2 text-xs font-bold text-zinc-500">
          {alarm.messages.length} {alarm.messages.length === 1 ? "sending" : "sendinger"}
        </span>
      </summary>
      <div className="grid gap-4 border-t border-zinc-200 bg-white p-4">
        <ol className="grid gap-3">
          {alarm.messages.length === 0 ? (
            <li className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
              Alarmen har ingen gemte sendinger.
            </li>
          ) : (
            alarm.messages.map((message) => (
              <li className="rounded-lg border border-zinc-200 bg-zinc-50 p-3" key={message.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black">Sending {message.sequenceNumber}</p>
                  <time className="text-xs font-semibold text-zinc-500" dateTime={message.receivedAt}>
                    {formatDateTime(new Date(message.receivedAt))}
                  </time>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm font-semibold leading-relaxed text-zinc-900">
                  {message.rawMessage}
                </pre>
              </li>
            ))
          )}
        </ol>

        <form
          action={action}
          className="grid gap-3 border-t border-red-100 pt-4"
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
