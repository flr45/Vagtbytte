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
      className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand-red px-5 text-base font-semibold text-white disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingText : children}
    </button>
  );
}
