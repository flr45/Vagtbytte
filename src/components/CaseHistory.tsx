import { visibleCaseHistoryEntries, type CaseHistoryEntry } from "@/lib/case-history";
import { HistoryIcon, InboxIcon } from "./Icons";

export function CaseHistory({ entries }: { entries: CaseHistoryEntry[] }) {
  const visibleEntries = visibleCaseHistoryEntries(entries);

  return (
    <details className="app-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-zinc-800">
        <HistoryIcon className="size-4" />
        Vis historik
      </summary>
      {visibleEntries.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
          <InboxIcon className="size-5 text-zinc-400" />
          <p>Ingen historik endnu.</p>
        </div>
      ) : (
        <ol className="mt-4 grid gap-3">
          {visibleEntries.map((entry) => (
            <li className="grid grid-cols-[4rem_1fr] gap-3 text-sm leading-snug text-zinc-700" key={`${entry.at.toISOString()}-${entry.action}`}>
              <span className="font-semibold text-zinc-950">{shortTime(entry.at)}</span>
              <span className="min-w-0 truncate">
                {entry.action}
                {entry.actor ? <span className="text-zinc-500"> · {entry.actor}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

function shortTime(date: Date) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen"
  }).format(date);
}
