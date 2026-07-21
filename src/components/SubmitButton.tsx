"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Gemmer..."
}: {
  children: React.ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="app-button-primary w-full sm:w-auto"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingText : children}
    </button>
  );
}
