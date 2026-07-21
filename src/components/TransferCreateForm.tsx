"use client";

import { useActionState, useState } from "react";
import { createTransferAction, lookupTransferParticipantsAction } from "@/lib/actions";
import { formatDateTimeLocalForConfirmation } from "@/lib/copenhagen-datetime";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

type FormValues = {
  giverEmployeeNumber: string;
  receiverEmployeeNumber: string;
  requestedStartAt: string;
  expectedEndMode: "SPECIFIC_TIME" | "UNTIL_SHIFT_END" | "";
  expectedEndAt: string;
  comment: string;
};

const initialValues: FormValues = {
  giverEmployeeNumber: "",
  receiverEmployeeNumber: "",
  requestedStartAt: "",
  expectedEndMode: "",
  expectedEndAt: "",
  comment: ""
};

export function TransferCreateForm({ defaultEmployeeNumber }: { defaultEmployeeNumber: string }) {
  const [values, setValues] = useState<FormValues>({
    ...initialValues,
    giverEmployeeNumber: defaultEmployeeNumber
  });
  const [lookupState, lookupAction] = useActionState(lookupTransferParticipantsAction, {});
  const [createState, createAction] = useActionState(createTransferAction, {});

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid gap-5">
      <form action={lookupAction} className="app-card grid gap-4">
        <h1 className="text-2xl font-bold">Nyt vagtbytte</h1>
        <FormFields values={values} update={update} />
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          VC styrer afslutningen.
        </p>
        <ActionMessage message={lookupState.message} ok={lookupState.ok} />
        <SubmitButton pendingText="Kontrollerer...">Kontroller medarbejdernumre</SubmitButton>
      </form>

      {lookupState.ok && lookupState.giver && lookupState.receiver ? (
        <form action={createAction} className="app-card grid gap-4">
          <h2 className="text-xl font-bold">Bekræft</h2>
          <div className="grid gap-3 rounded-2xl bg-brand-mist p-4">
            <p className="font-semibold">
              Afgiver: {lookupState.giver.name} - {lookupState.giver.employeeNumber}
            </p>
            <p className="font-semibold">
              Overtager: {lookupState.receiver.name} - {lookupState.receiver.employeeNumber}
            </p>
            <p className="font-semibold">Start: {formatDateTimeLocalForConfirmation(values.requestedStartAt)}</p>
            <p className="font-semibold">
              Forventet tilbagelevering:{" "}
              {values.expectedEndMode === "SPECIFIC_TIME"
                ? formatDateTimeLocalForConfirmation(values.expectedEndAt)
                : values.expectedEndMode === "UNTIL_SHIFT_END"
                  ? "Til vagtens slutning"
                  : "Ikke valgt"}
            </p>
          </div>
          {Object.entries(values).map(([name, value]) => (
            <input key={name} name={name} type="hidden" value={value} />
          ))}
          <label className="flex min-h-12 items-start gap-3 text-sm font-semibold text-zinc-800">
            <input className="mt-1 h-5 w-5 accent-brand-red" name="confirmed" type="checkbox" />
            Oplysningerne er korrekte.
          </label>
          <ActionMessage message={createState.message} ok={createState.ok} />
          <SubmitButton pendingText="Opretter...">Opret vagtoverdragelse</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

function FormFields({
  values,
  update
}: {
  values: FormValues;
  update: (field: keyof FormValues, value: string) => void;
}) {
  return (
    <>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Medarbejdernummer A
        <input
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name="giverEmployeeNumber"
          onChange={(event) => update("giverEmployeeNumber", event.target.value)}
          required
          type="text"
          value={values.giverEmployeeNumber}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Medarbejdernummer B
        <input
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name="receiverEmployeeNumber"
          onChange={(event) => update("receiverEmployeeNumber", event.target.value)}
          required
          type="text"
          value={values.receiverEmployeeNumber}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Startdato og starttid
        <input
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name="requestedStartAt"
          onChange={(event) => update("requestedStartAt", event.target.value)}
          required
          type="datetime-local"
          value={values.requestedStartAt}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Forventet tilbagelevering
        <span className="grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 shadow-sm">
            <input
              checked={values.expectedEndMode === "SPECIFIC_TIME"}
              className="h-5 w-5 accent-brand-red"
              name="expectedEndMode"
              onChange={() => update("expectedEndMode", "SPECIFIC_TIME")}
              required
              type="radio"
              value="SPECIFIC_TIME"
            />
            Bestemt tidspunkt
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 shadow-sm">
            <input
              checked={values.expectedEndMode === "UNTIL_SHIFT_END"}
              className="h-5 w-5 accent-brand-red"
              name="expectedEndMode"
              onChange={() => {
                update("expectedEndMode", "UNTIL_SHIFT_END");
                update("expectedEndAt", "");
              }}
              required
              type="radio"
              value="UNTIL_SHIFT_END"
            />
            Til vagt slut
          </label>
        </span>
      </label>
      {values.expectedEndMode === "SPECIFIC_TIME" ? (
        <label className="grid gap-2 text-sm font-semibold text-zinc-800">
          Forventet tilbageleveringsdato og tidspunkt
          <input
            className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
            name="expectedEndAt"
            onChange={(event) => update("expectedEndAt", event.target.value)}
            required
            type="datetime-local"
            value={values.expectedEndAt}
          />
        </label>
      ) : (
        <input name="expectedEndAt" type="hidden" value="" />
      )}
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Kommentar
        <textarea
          className="focus-ring min-h-28 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base shadow-sm"
          maxLength={500}
          name="comment"
          onChange={(event) => update("comment", event.target.value)}
          value={values.comment}
        />
      </label>
    </>
  );
}
