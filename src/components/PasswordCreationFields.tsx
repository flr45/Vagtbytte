"use client";

import { useId, useMemo, useState } from "react";
import { evaluatePasswordRequirements } from "@/lib/password-policy";

type PasswordCreationFieldsProps = {
  passwordName: string;
  passwordLabel?: string;
  confirmationName?: string;
  confirmationLabel?: string;
  required?: boolean;
  showConfirmation?: boolean;
};

export function PasswordCreationFields({
  passwordName,
  passwordLabel = "Ny adgangskode",
  confirmationName = "confirmPassword",
  confirmationLabel = "Gentag adgangskode",
  required = true,
  showConfirmation = true
}: PasswordCreationFieldsProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const requirementsId = useId();
  const confirmationId = useId();
  const requirements = useMemo(() => evaluatePasswordRequirements(password), [password]);
  const showStatus = required || password.length > 0;
  const confirmationMatches = confirmation.length > 0 && confirmation === password;

  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        {passwordLabel}
        <input
          aria-describedby={showStatus ? requirementsId : undefined}
          autoComplete="new-password"
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name={passwordName}
          onChange={(event) => setPassword(event.target.value)}
          required={required}
          type="password"
          value={password}
        />
      </label>

      {showStatus ? (
        <div
          className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
          id={requirementsId}
          aria-live="polite"
        >
          <p className="text-sm font-black text-zinc-800">Krav til adgangskoden</p>
          <ul className="mt-2 grid gap-2 text-sm font-semibold">
            {requirements.map((requirement) => (
              <li
                className={requirement.met ? "flex items-center gap-2 text-emerald-700" : "flex items-center gap-2 text-zinc-600"}
                key={requirement.id}
              >
                <span aria-hidden="true" className="w-5 text-center">
                  {requirement.met ? "✓" : "○"}
                </span>
                <span>{requirement.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showConfirmation ? (
        <label className="grid gap-2 text-sm font-semibold text-zinc-800">
          {confirmationLabel}
          <input
            aria-describedby={confirmation.length > 0 ? confirmationId : undefined}
            autoComplete="new-password"
            className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
            name={confirmationName}
            onChange={(event) => setConfirmation(event.target.value)}
            required={required}
            type="password"
            value={confirmation}
          />
          {confirmation.length > 0 ? (
            <span
              className={confirmationMatches ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-red-700"}
              id={confirmationId}
              aria-live="polite"
            >
              {confirmationMatches ? "✓ Adgangskoderne er ens" : "Adgangskoderne er ikke ens endnu"}
            </span>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}
