"use client";

export function ActionMessage({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
      role="status"
    >
      {message}
    </p>
  );
}
