import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { listRecentAlarmsForStations } from "@/lib/alarm-feed";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function AlarmFeedPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const alarms = await listRecentAlarmsForStations(user.alarmStations);

  return (
    <>
      <TopBar title="Alarmfeed" />
      <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="font-black">Informationssystem</p>
          <p className="mt-1 text-sm font-semibold">
            Pageren og den officielle alarmering har altid første prioritet. Alarmfeed viser kun de SMS-beskeder,
            som systemet har modtaget.
          </p>
        </section>

        <header>
          <p className="text-sm font-black uppercase tracking-wide text-brand-red">SBR Portal</p>
          <h1 className="mt-1 text-3xl font-black">Alarmfeed</h1>
          <p className="mt-2 font-semibold text-zinc-600">
            Originale meldinger fra vagtcentralen, vist uden omskrivning eller fortolkning.
          </p>
        </header>

        {alarms.length === 0 ? (
          <section className="app-card">
            <h2 className="text-xl font-black">Ingen meldinger endnu</h2>
            <p className="mt-2 font-semibold text-zinc-600">
              Nye SMS-meldinger fra dine valgte stationer vises her automatisk.
            </p>
          </section>
        ) : (
          alarms.map((alarm) => (
            <article className="app-card grid gap-4" key={alarm.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-brand-red">
                    {alarm.status === "ACTIVE" ? "● Aktiv alarm" : "Afsluttet alarm"}
                  </p>
                  <h2 className="mt-1 text-xl font-black">Alarm {formatDateTime(alarm.openedAt)}</h2>
                  <p className="mt-1 text-sm font-semibold text-zinc-600">
                    {alarm.messages.length} {alarm.messages.length === 1 ? "sending" : "sendinger"}
                  </p>
                </div>
              </div>

              <ol className="grid gap-3">
                {alarm.messages.map((message) => (
                  <li className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4" key={message.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">Sending {message.sequenceNumber}</p>
                      <time className="text-sm font-bold text-zinc-600" dateTime={message.receivedAt.toISOString()}>
                        {formatTime(message.receivedAt)}
                      </time>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-base font-semibold leading-relaxed text-zinc-950">
                      {message.rawMessage}
                    </pre>
                  </li>
                ))}
              </ol>
            </article>
          ))
        )}
      </main>
    </>
  );
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen"
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen"
  }).format(date);
}
