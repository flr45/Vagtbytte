"use client";

export function OperationalPrintButton() {
  return (
    <button className="app-button-primary w-full print:hidden" onClick={() => window.print()} type="button">
      Print label
    </button>
  );
}
