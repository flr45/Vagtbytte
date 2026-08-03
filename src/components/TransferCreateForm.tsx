"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { createTransferAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

type FirefighterOption = {
  id: string;
  name: string;
  employeeNumber: string;
};

type FormValues = {
  requestedStartAt: string;
  expectedEndMode: "SPECIFIC_TIME" | "UNTIL_SHIFT_END" | "";
  expectedEndAt: string;
  comment: string;
};

export function TransferCreateForm({
  defaultEmployeeNumber,
  defaultStartAt,
  firefighters
}: {
  defaultEmployeeNumber: string;
  defaultStartAt: string;
  firefighters: FirefighterOption[];
}) {
  const defaultGiver = firefighters.find(
    (firefighter) => firefighter.employeeNumber === defaultEmployeeNumber
  ) ?? null;
  const [giver, setGiver] = useState<FirefighterOption | null>(defaultGiver);
  const [receiver, setReceiver] = useState<FirefighterOption | null>(null);
  const [values, setValues] = useState<FormValues>(() => ({
    requestedStartAt: defaultStartAt,
    expectedEndMode: "",
    expectedEndAt: "",
    comment: ""
  }));
  const [createState, createAction] = useActionState(createTransferAction, {});
  const samePerson = Boolean(giver && receiver && giver.id === receiver.id);

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form action={createAction} className="app-card grid gap-5">
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-brand-red">Vagtoverdragelse</p>
        <h1 className="mt-1 text-3xl font-black">Nyt vagtbytte</h1>
        <p className="mt-2 text-sm font-semibold text-zinc-600">
          Vælg afgiver og overtager, angiv tidspunktet og kontrollér oplysningerne før oprettelse.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl bg-zinc-50 p-4">
        <PersonSearch
          firefighters={firefighters}
          label="Afgiver"
          name="giverEmployeeNumber"
          onSelect={setGiver}
          selected={giver}
        />
        <div aria-hidden="true" className="text-center text-xl font-black text-zinc-400">↓</div>
        <PersonSearch
          firefighters={firefighters}
          label="Overtager"
          name="receiverEmployeeNumber"
          onSelect={setReceiver}
          selected={receiver}
        />
      </div>

      {samePerson ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">
          Afgiver og overtager skal være to forskellige personer.
        </p>
      ) : null}

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

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-zinc-800">Forventet tilbagelevering</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 font-semibold shadow-sm transition ${
              values.expectedEndMode === "SPECIFIC_TIME"
                ? "border-brand-red bg-red-50 text-red-950"
                : "border-zinc-200 bg-white"
            }`}
          >
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
          <label
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 font-semibold shadow-sm transition ${
              values.expectedEndMode === "UNTIL_SHIFT_END"
                ? "border-brand-red bg-red-50 text-red-950"
                : "border-zinc-200 bg-white"
            }`}
          >
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
            Til vagtens slutning
          </label>
        </div>
      </fieldset>

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
        Kommentar <span className="font-normal text-zinc-500">(valgfri)</span>
        <textarea
          className="focus-ring min-h-24 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base shadow-sm"
          maxLength={500}
          name="comment"
          onChange={(event) => update("comment", event.target.value)}
          value={values.comment}
        />
      </label>

      <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">
        Vagtbyttet bliver først gyldigt, når overtageren og vagtcentralen har godkendt det.
      </p>
      <ActionMessage message={createState.message} ok={createState.ok} />
      <SubmitButton disabled={!giver || !receiver || samePerson} pendingText="Opretter...">
        Opret vagtoverdragelse
      </SubmitButton>
    </form>
  );
}

function PersonSearch({
  label,
  name,
  firefighters,
  selected,
  onSelect
}: {
  label: string;
  name: string;
  firefighters: FirefighterOption[];
  selected: FirefighterOption | null;
  onSelect: (person: FirefighterOption | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState(() => selected ? displayPerson(selected) : "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = normalize(query);
  const results = useMemo(() => {
    if (!normalizedQuery || selected) return [];
    return firefighters
      .filter((firefighter) =>
        normalize(`${firefighter.name} ${firefighter.employeeNumber}`).includes(normalizedQuery)
      )
      .slice(0, 8);
  }, [firefighters, normalizedQuery, selected]);

  function choose(person: FirefighterOption) {
    onSelect(person);
    setQuery(displayPerson(person));
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="relative grid gap-2">
      <label className="text-sm font-semibold text-zinc-800" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <input name={name} type="hidden" value={selected?.employeeNumber ?? ""} />
      <input
        aria-activedescendant={results[activeIndex] ? `${listId}-option-${results[activeIndex].id}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && !selected}
        autoComplete="off"
        className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 pr-20 text-base shadow-sm"
        id={`${listId}-input`}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          if (!selected && normalizedQuery) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (selected) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open && results[activeIndex]) {
            event.preventDefault();
            choose(results[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Søg på navn eller nummer"
        required
        role="combobox"
        type="search"
        value={query}
      />
      {selected ? (
        <button
          className="focus-ring absolute right-2 top-8 min-h-10 rounded-lg px-3 text-sm font-bold text-brand-red hover:bg-red-50"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setOpen(false);
            setActiveIndex(0);
          }}
          type="button"
        >
          Skift
        </button>
      ) : null}
      {open && !selected && normalizedQuery ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-xl"
          id={listId}
          role="listbox"
        >
          {results.length > 0 ? (
            results.map((firefighter, index) => (
              <button
                aria-selected={index === activeIndex}
                className={`focus-ring flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${
                  index === activeIndex ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
                id={`${listId}-option-${firefighter.id}`}
                key={firefighter.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(firefighter)}
                role="option"
                type="button"
              >
                <span className="font-bold text-zinc-950">{firefighter.name}</span>
                <span className="shrink-0 font-semibold text-zinc-600">{firefighter.employeeNumber}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-sm font-semibold text-zinc-600">Ingen brandfolk matcher søgningen.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function displayPerson(person: FirefighterOption) {
  return `${person.name} – ${person.employeeNumber}`;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("da-DK");
}
