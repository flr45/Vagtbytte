"use client";

import { useActionState } from "react";
import { resetAlarmStatisticsAction } from "@/lib/alarm-statistics-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function AlarmStatisticsControls() {
  const [state, action] = useActionState(resetAlarmStatisticsAction, {});

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <a
        className="app-button-secondary w-full"
        href="/api/admin/alarm-statistik/export"
      >
        Eksportér CSV
      </a>
      <form
        action={action}
        className="grid gap-2"
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Vil du nulstille alarmstatistikken? Tidligere alarmer bliver ikke slettet, men tælles ikke længere med."
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <ActionMessage message={state.message} ok={state.ok} />
        <SubmitButton pendingText="Nulstiller…">Nulstil statistik</SubmitButton>
      </form>
    </div>
  );
}
