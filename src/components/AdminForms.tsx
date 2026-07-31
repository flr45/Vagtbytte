"use client";

import { useActionState } from "react";
import {
  createFirefighterAction,
  resetPasswordAction,
  updateFirefighterAction,
  updateVcAction
} from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { AlarmStationSelector } from "./AlarmStationSelector";
import { Checkbox, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

type UserListItem = {
  id: string;
  name: string;
  employeeNumber: string | null;
  loginIdentifier: string;
  isActive: boolean;
  alarmStations: string[];
};

export function CreateFirefighterForm() {
  const [state, action] = useActionState(createFirefighterAction, {});

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-brand-line bg-white p-4">
      <h2 className="text-xl font-bold">Opret brandmand</h2>
      <Field label="Navn" name="name" />
      <Field label="Medarbejdernummer" name="employeeNumber" />
      <Field
        autoComplete="new-password"
        label="Midlertidig adgangskode"
        name="temporaryPassword"
        type="password"
      />
      <Checkbox defaultChecked label="Aktiv" name="isActive" />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton>Opret brandmand</SubmitButton>
    </form>
  );
}

export function FirefighterEditForms({ users }: { users: UserListItem[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-brand-line bg-white p-4">
        <h2 className="text-xl font-bold">Brandmænd</h2>
        <p className="mt-2 text-sm text-zinc-600">Der er endnu ikke oprettet brandmænd.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {users.map((user) => (
        <FirefighterEditForm key={user.id} user={user} />
      ))}
    </div>
  );
}

function FirefighterEditForm({ user }: { user: UserListItem }) {
  const [editState, editAction] = useActionState(updateFirefighterAction, {});
  const [resetState, resetAction] = useActionState(resetPasswordAction, {});

  return (
    <section className="rounded-lg border border-brand-line bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold">{user.name}</h3>
        <span
          className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
            user.isActive ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {user.isActive ? "Aktiv" : "Deaktiveret"}
        </span>
      </div>
      <form action={editAction} className="mt-4 grid gap-4">
        <input name="userId" type="hidden" value={user.id} />
        <Field defaultValue={user.name} label="Navn" name="name" />
        <Field
          defaultValue={user.employeeNumber ?? ""}
          label="Medarbejdernummer"
          name="employeeNumber"
        />
        <Checkbox defaultChecked={user.isActive} label="Aktiv" name="isActive" />
        <ActionMessage message={editState.message} ok={editState.ok} />
        <SubmitButton>Gem brandmand</SubmitButton>
      </form>
      <div className="mt-5 border-t border-brand-line pt-4">
        <AlarmStationSelector userId={user.id} initialStations={user.alarmStations} />
      </div>
      <form action={resetAction} className="mt-5 grid gap-4 border-t border-brand-line pt-4">
        <input name="userId" type="hidden" value={user.id} />
        <Field
          autoComplete="new-password"
          label="Ny midlertidig adgangskode"
          name="temporaryPassword"
          type="password"
        />
        <ActionMessage message={resetState.message} ok={resetState.ok} />
        <SubmitButton>Nulstil adgangskode</SubmitButton>
      </form>
    </section>
  );
}

export function VcForm({
  vc
}: {
  vc: { loginIdentifier: string; isActive: boolean } | null;
}) {
  const [state, action] = useActionState(updateVcAction, {});

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-brand-line bg-white p-4">
      <h2 className="text-xl font-bold">VC-konto</h2>
      <p className="text-sm text-zinc-600">
        Der må kun være én fælles aktiv konto til vagtcentralen i denne version.
      </p>
      <Field
        defaultValue={vc?.loginIdentifier ?? "vc"}
        label="Brugernavn"
        name="loginIdentifier"
      />
      <Field
        autoComplete="new-password"
        label="Ny adgangskode"
        name="temporaryPassword"
        required={false}
        type="password"
      />
      <Checkbox defaultChecked={vc?.isActive ?? true} label="Aktiv" name="isActive" />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton>Gem VC-konto</SubmitButton>
    </form>
  );
}
