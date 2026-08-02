"use client";

import { useActionState } from "react";
import { updateVcAction } from "@/lib/actions";
import {
  createManagedUserAction,
  deleteManagedUserAction,
  resetManagedUserPasswordAction,
  updateManagedUserAction
} from "@/lib/admin-user-actions";
import { STATIONS } from "@/lib/stations";
import { ActionMessage } from "./ActionMessage";
import { Checkbox, Field } from "./Field";
import { PasswordCreationFields } from "./PasswordCreationFields";
import { SubmitButton } from "./SubmitButton";

type UserListItem = {
  id: string;
  name: string;
  employeeNumber: string | null;
  loginIdentifier: string;
  email: string | null;
  isActive: boolean;
  stationCode: string | null;
  alarmStations: string[];
  receiveAlarmFollowUps: boolean;
  hasAdminAccess: boolean;
};

export function CreateFirefighterForm() {
  const [state, action] = useActionState(createManagedUserAction, {});

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-brand-line bg-white p-4">
      <div>
        <h2 className="text-xl font-bold">Opret bruger</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Mailadressen bruges til sikker nulstilling af adgangskoden.
        </p>
      </div>
      <Field label="Navn" name="name" />
      <Field label="Medarbejdernummer" name="employeeNumber" />
      <Field autoComplete="email" label="Mailadresse" name="email" type="email" />
      <PasswordCreationFields
        passwordLabel="Midlertidig adgangskode"
        passwordName="temporaryPassword"
        showConfirmation={false}
      />
      <StationSelect name="stationCode" />
      <AlarmStationCheckboxes />
      <Checkbox
        label="Vis opfølgende sendinger (sending 2+)"
        name="receiveAlarmFollowUps"
      />
      <p className="-mt-2 text-sm font-semibold text-zinc-600">
        Telefonnotifikation sendes kun ved den primære alarmmelding.
      </p>
      <Checkbox defaultChecked label="Aktiv" name="isActive" />
      <Checkbox label="Administratoradgang" name="hasAdminAccess" />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton>Opret bruger</SubmitButton>
    </form>
  );
}

export function FirefighterEditForms({ users }: { users: UserListItem[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-brand-line bg-white p-4">
        <p className="text-sm text-zinc-600">Der er endnu ikke oprettet brugere.</p>
      </div>
    );
  }

  const grouped = STATIONS.map((station) => ({
    code: station.code,
    label: station.label,
    users: users.filter((user) => user.stationCode === station.code)
  }));
  const withoutStation = users.filter(
    (user) => !STATIONS.some((station) => station.code === user.stationCode)
  );

  return (
    <div className="grid gap-3">
      {grouped.map((group) => (
        <UserStationGroup key={group.code} label={group.label} users={group.users} />
      ))}
      {withoutStation.length > 0 ? (
        <UserStationGroup label="Uden station" users={withoutStation} />
      ) : null}
    </div>
  );
}

function UserStationGroup({ label, users }: { label: string; users: UserListItem[] }) {
  return (
    <details className="rounded-lg border border-brand-line bg-white">
      <summary className="focus-ring flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg px-4 font-bold">
        <span>{label}</span>
        <span className="text-sm font-semibold text-zinc-500">{users.length}</span>
      </summary>
      <div className="grid gap-2 border-t border-brand-line p-3">
        {users.length === 0 ? (
          <p className="p-2 text-sm text-zinc-500">Ingen brugere på denne station.</p>
        ) : (
          users.map((user) => <FirefighterEditForm key={user.id} user={user} />)
        )}
      </div>
    </details>
  );
}

function FirefighterEditForm({ user }: { user: UserListItem }) {
  const [editState, editAction] = useActionState(updateManagedUserAction, {});
  const [resetState, resetAction] = useActionState(resetManagedUserPasswordAction, {});
  const [deleteState, deleteAction] = useActionState(deleteManagedUserAction, {});

  return (
    <details className="rounded-lg border border-zinc-200 bg-zinc-50">
      <summary className="focus-ring min-h-12 cursor-pointer rounded-lg px-4 py-3 font-bold">
        <span>{user.name}</span>
        {!user.email ? (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
            Mangler mail
          </span>
        ) : null}
      </summary>
      <div className="grid gap-5 border-t border-zinc-200 bg-white p-4">
        <form action={editAction} className="grid gap-4">
          <input name="userId" type="hidden" value={user.id} />
          <Field defaultValue={user.name} label="Navn" name="name" />
          <Field
            defaultValue={user.employeeNumber ?? ""}
            label="Medarbejdernummer"
            name="employeeNumber"
          />
          <Field
            autoComplete="email"
            defaultValue={user.email ?? ""}
            label="Mailadresse til nulstilling"
            name="email"
            required={false}
            type="email"
          />
          {!user.email ? (
            <p className="-mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Brugeren kan først nulstille sin egen adgangskode, når en mailadresse er gemt.
            </p>
          ) : null}
          <StationSelect defaultValue={user.stationCode ?? "A"} name="stationCode" />
          <AlarmStationCheckboxes selected={user.alarmStations} />
          <Checkbox
            defaultChecked={user.receiveAlarmFollowUps}
            label="Vis opfølgende sendinger (sending 2+)"
            name="receiveAlarmFollowUps"
          />
          <p className="-mt-2 text-sm font-semibold text-zinc-600">
            Telefonnotifikation sendes kun ved den primære alarmmelding.
          </p>
          <Checkbox defaultChecked={user.isActive} label="Aktiv" name="isActive" />
          <Checkbox
            defaultChecked={user.hasAdminAccess}
            label="Administratoradgang"
            name="hasAdminAccess"
          />
          <ActionMessage message={editState.message} ok={editState.ok} />
          <SubmitButton>Gem bruger</SubmitButton>
        </form>

        <form action={resetAction} className="grid gap-4 border-t border-brand-line pt-5">
          <input name="userId" type="hidden" value={user.id} />
          <div>
            <h3 className="font-black">Administratornulstilling</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Brugeren bliver logget ud og skal vælge en ny adgangskode ved næste login.
            </p>
          </div>
          <PasswordCreationFields
            passwordLabel="Ny midlertidig adgangskode"
            passwordName="temporaryPassword"
            showConfirmation={false}
          />
          <ActionMessage message={resetState.message} ok={resetState.ok} />
          <SubmitButton>Nulstil adgangskode</SubmitButton>
        </form>

        <form
          action={deleteAction}
          className="grid gap-3 border-t border-red-100 pt-5"
          onSubmit={(event) => {
            if (!window.confirm(`Vil du slette ${user.name}? Handlingen kan ikke fortrydes.`)) {
              event.preventDefault();
            }
          }}
        >
          <input name="userId" type="hidden" value={user.id} />
          <ActionMessage message={deleteState.message} ok={deleteState.ok} />
          <button className="app-button-danger w-full sm:w-fit" type="submit">
            Slet bruger
          </button>
        </form>
      </div>
    </details>
  );
}

function StationSelect({
  name,
  defaultValue = "A"
}: {
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-700">
      Tilknyttet station
      <select
        className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base font-semibold text-zinc-950"
        defaultValue={defaultValue}
        name={name}
      >
        {STATIONS.map((station) => (
          <option key={station.code} value={station.code}>
            {station.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AlarmStationCheckboxes({ selected = [] }: { selected?: string[] }) {
  return (
    <fieldset className="grid gap-3 rounded-lg border border-brand-line bg-zinc-50 p-3">
      <div>
        <legend className="font-bold">Alarmstationer</legend>
        <p className="text-sm text-zinc-600">Vælg hvilke alarmmeldinger brugeren skal modtage.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {STATIONS.map((station) => (
          <label
            className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-200 bg-white px-3"
            key={station.code}
          >
            <input
              defaultChecked={selected.includes(station.code)}
              name="alarmStations"
              type="checkbox"
              value={station.code}
            />
            <span className="font-semibold">({station.code}) {station.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
      <PasswordCreationFields
        passwordLabel="Ny adgangskode (valgfri)"
        passwordName="temporaryPassword"
        required={false}
        showConfirmation={false}
      />
      <Checkbox defaultChecked={vc?.isActive ?? true} label="Aktiv" name="isActive" />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton>Gem VC-konto</SubmitButton>
    </form>
  );
}
