"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Gemmer...",
  disabled = false
}: {
  children: React.ReactNode;
  pendingText?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="app-button-primary w-full sm:w-auto"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? pendingText : children}
    </button>
  );
}
