"use client";

export function ActionMessage({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${
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
