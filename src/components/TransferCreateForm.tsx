"use client";

import { useActionState, useState } from "react";
import { createTransferAction, lookupTransferParticipantsAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

type FormValues = {
  giverEmployeeNumber: string;
  receiverEmployeeNumber: string;
  requestedStartAt: string;
  expectedEndAt: string;
  comment: string;
};

const initialValues: FormValues = {
  giverEmployeeNumber: "",
  receiverEmployeeNumber: "",
  requestedStartAt: "",
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
      <form action={lookupAction} className="grid gap-4 rounded-lg border border-brand-line bg-white p-4">
        <h1 className="text-2xl font-bold">Opret vagtoverdragelse</h1>
        <FormFields values={values} update={update} />
        <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Forventet sluttid er kun en påmindelse. Vagten tilbageleveres ikke automatisk.
        </p>
        <ActionMessage message={lookupState.message} ok={lookupState.ok} />
        <SubmitButton pendingText="Kontrollerer...">Kontroller medarbejdernumre</SubmitButton>
      </form>

      {lookupState.ok && lookupState.giver && lookupState.receiver ? (
        <form action={createAction} className="grid gap-4 rounded-lg border border-brand-line bg-white p-4">
          <h2 className="text-xl font-bold">Bekræft oplysninger</h2>
          <div className="grid gap-3 rounded-md bg-brand-mist p-4">
            <p className="font-semibold">
              Afgiver: {lookupState.giver.name} - {lookupState.giver.employeeNumber}
            </p>
            <p className="font-semibold">
              Overtager: {lookupState.receiver.name} - {lookupState.receiver.employeeNumber}
            </p>
          </div>
          {Object.entries(values).map(([name, value]) => (
            <input key={name} name={name} type="hidden" value={value} />
          ))}
          <label className="flex min-h-12 items-start gap-3 text-sm font-semibold text-zinc-800">
            <input className="mt-1 h-5 w-5 accent-brand-red" name="confirmed" type="checkbox" />
            Jeg bekræfter, at oplysningerne er korrekte.
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
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
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
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
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
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
          name="requestedStartAt"
          onChange={(event) => update("requestedStartAt", event.target.value)}
          required
          type="datetime-local"
          value={values.requestedStartAt}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Forventet slutdato og sluttid
        <input
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
          name="expectedEndAt"
          onChange={(event) => update("expectedEndAt", event.target.value)}
          type="datetime-local"
          value={values.expectedEndAt}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Kommentar
        <textarea
          className="focus-ring min-h-28 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base"
          maxLength={500}
          name="comment"
          onChange={(event) => update("comment", event.target.value)}
          value={values.comment}
        />
      </label>
    </>
  );
}
