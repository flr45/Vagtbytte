import Link from "next/link";
import { redirect } from "next/navigation";
import { AvailabilityStatus } from "@prisma/client";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { SbrFirePageFrame } from "@/components/SbrFireApp";
import { canAccessOperationalPortal, requireUser } from "@/lib/auth";
import { listRecentAlarmsForStations } from "@/lib/alarm-feed";
import { applyAlarmFollowUpVisibility, groupAlarmFeedForDisplay } from "@/lib/alarm-feed-view";
import { prisma } from "@/lib/prisma";
import { stationLabel } from "@/lib/stations";

export const dynamic = "force-dynamic";

const activeTransferStatuses = [
  "AWAITING_RECEIVER",
  "RECEIVER_ACCEPTED_AWAITING_VC",
  "VC_APPROVED_AWAITING_ACTIVATION",
  "VC_APPROVED_ACTIVE",
  "RETURN_AWAITING_ORIGINAL",
  "RETURN_ACCEPTED_AWAITING_VC",
  "RETURN_APPROVED_AWAITING_EXECUTION"
] as const;

export default async function SbrFireHomePage() {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/skift-adgangskode");

  const unreadCount = await prisma.notification.count({
    where: { recipientUserId: user.id, readAt: null, publishedAt: { not: null }, cancelledAt: null }
  });

  const firefighterData = user.role === "BRANDFIGHTER" ? await getFirefighterHomeData(user.id) : null;
  const vcPending = user.role === "VC"
    ? await prisma.shiftTransfer.count({ where: { status: "RECEIVER_ACCEPTED_AWAITING_VC" } })
    : 0;
  const operationalAccess = canAccessOperationalPortal(user);
  const hasAdminAccess = user.role === "ADMIN" || user.hasAdminAccess;

  return (
    <SbrFirePageFrame active="home" right={<AppIcon className="size-4 text-red-100" name="status" />} title="Hjem">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1317] shadow-xl">
        <div className="bg-gradient-to-br from-[#b70f18] via-[#8f0d16] to-[#39070b] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Slagelse Brand og Redning</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white">{greeting()}, {firstName(user.name)}</h2>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-red-50/75">
            Alarm, vagter og operativ viden samlet ét sted.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 bg-[#0a0f12]">
          <Metric label="Ulæste" value={String(unreadCount)} />
          <Metric label="Rolle" value={roleLabel(user.role)} />
          <Metric label="Operativ" value={operationalAccess ? "Ja" : "—"} />
        </div>
      </section>

      {firefighterData?.latestAlarm ? (
        <Link
          className="group overflow-hidden rounded-2xl border border-red-500/30 bg-[#0d1317] shadow-xl transition hover:border-red-500/60"
          href={`/brandmand/alarmer#alarm-${firefighterData.latestAlarm.id}`}
        >
          <div className="flex items-center justify-between bg-[#b70f18] px-4 py-2.5">
            <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-100/75">
              <AppIcon className="size-4" name="alarm" /> Seneste alarm
            </p>
            <span className="text-xs font-black text-white">{formatTime(firefighterData.latestAlarm.openedAt)}</span>
          </div>
          <div className="grid gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-black text-white">{stationLabel(firefighterData.latestAlarm.stationCode)}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${firefighterData.latestAlarm.status === "ACTIVE" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-slate-400"}`}>
                {firefighterData.latestAlarm.status === "ACTIVE" ? "Aktiv" : "Afsluttet"}
              </span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-300">
              {firefighterData.latestMessage}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-black text-red-400 group-hover:text-red-300">Åbn alarm <AppIcon className="size-4" name="chevronRight" /></p>
          </div>
        </Link>
      ) : user.role === "BRANDFIGHTER" ? (
        <section className="rounded-2xl border border-white/10 bg-[#0d1317] p-4">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"><AppIcon className="size-4" name="alarm" /> Alarm</p>
          <h3 className="mt-1 text-lg font-black">Ingen alarmer i feedet</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">Nye meldinger fra dine valgte stationer vises her automatisk.</p>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Moduler</p>
            <h2 className="mt-1 text-xl font-black">SBR Fire App</h2>
          </div>
          {unreadCount > 0 && user.role !== "ADMIN" ? (
            <Link className="rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-black text-white" href={notificationHref(user.role)}>
              {unreadCount} notifikation{unreadCount === 1 ? "" : "er"}
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {user.role === "BRANDFIGHTER" ? (
            <ModuleCard
              badge={firefighterData?.latestAlarm?.status === "ACTIVE" ? "AKTIV" : undefined}
              description="Meldinger fra dine stationer"
              href="/brandmand/alarmer"
              icon="alarm"
              title="Alarmer"
            />
          ) : null}

          <ModuleCard
            badge={user.role === "BRANDFIGHTER" && firefighterData?.requiresResponse ? String(firefighterData.requiresResponse) : user.role === "VC" && vcPending ? String(vcPending) : undefined}
            description={user.role === "VC" ? "Godkendelser og tildelinger" : user.role === "ADMIN" ? "Brugere og system" : firefighterData?.activeTransfers ? `${firefighterData.activeTransfers} aktive sager` : "Overdrag og administrér vagter"}
            href={vagtHref(user.role)}
            icon={user.role === "ADMIN" ? "settings" : "swap"}
            title={user.role === "VC" ? "Vagtcentral" : user.role === "ADMIN" ? "Administration" : "Vagtbytte"}
          />

          {operationalAccess ? (
            <ModuleCard description="Køretøjer, udstyr og QR" href="/admin/operativ-portal" icon="truck" title="Operativ" />
          ) : null}

          {hasAdminAccess && user.role !== "ADMIN" ? (
            <ModuleCard description="Brugere, alarmer og system" href="/admin" icon="settings" title="Administration" />
          ) : null}

          <ModuleCard description="Notifikationer, profil og app" href="/app/mere" icon="more" title="Mere" />
        </div>
      </section>

      {user.role === "BRANDFIGHTER" && firefighterData?.assignment ? (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">Aktuel vagttildeling</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">Du er tildelt en vagt</h2>
              <p className="mt-1 text-sm font-semibold text-slate-400">
                {formatDateTime(firefighterData.assignment.assignedShiftStart)} → {formatDateTime(firefighterData.assignment.assignedShiftEnd)}
              </p>
            </div>
            <Link className="inline-flex items-center gap-1 rounded-lg bg-white px-4 py-2.5 text-xs font-black text-black" href={`/brandmand/til-raadighed/${firefighterData.assignment.id}`}>Åbn <AppIcon className="size-4" name="chevronRight" /></Link>
          </div>
        </section>
      ) : null}
    </SbrFirePageFrame>
  );
}

async function getFirefighterHomeData(userId: string) {
  const preferences = await prisma.user.findUnique({
    where: { id: userId },
    select: { alarmStations: true, receiveAlarmFollowUps: true }
  });
  const alarms = await listRecentAlarmsForStations(preferences?.alarmStations ?? [], 5);
  const visibleAlarms = applyAlarmFollowUpVisibility(
    groupAlarmFeedForDisplay(alarms),
    preferences?.receiveAlarmFollowUps ?? false
  );
  const latestAlarm = visibleAlarms[0] ?? null;
  const latestMessage = latestAlarm?.messages.at(-1)?.rawMessage ?? "";

  const [requiresResponse, activeTransfers, assignment] = await Promise.all([
    prisma.shiftTransfer.count({ where: { receiverUserId: userId, status: "AWAITING_RECEIVER" } }),
    prisma.shiftTransfer.count({
      where: {
        OR: [{ giverUserId: userId }, { receiverUserId: userId }],
        status: { in: [...activeTransferStatuses] }
      }
    }),
    prisma.availability.findFirst({
      where: {
        userId,
        status: { in: [AvailabilityStatus.ASSIGNED, AvailabilityStatus.ACKNOWLEDGED] },
        assignedShiftEnd: { gte: new Date() }
      },
      orderBy: { assignedShiftStart: "asc" }
    })
  ]);

  return { latestAlarm, latestMessage, requiresResponse, activeTransfers, assignment };
}

function ModuleCard({ title, description, href, icon, badge }: { title: string; description: string; href: string; icon: AppIconName; badge?: string }) {
  return (
    <Link className="group relative grid min-h-36 content-between overflow-hidden rounded-2xl border border-white/10 bg-[#0d1317] p-4 shadow-lg transition hover:-translate-y-0.5 hover:border-red-500/40" href={href}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-11 place-items-center rounded-xl bg-white/5 text-slate-200 transition group-hover:bg-red-500/10 group-hover:text-red-300"><AppIcon className="size-6" name={icon} /></span>
        {badge ? <span className="rounded-full bg-red-600 px-2 py-1 text-[9px] font-black text-white">{badge}</span> : null}
      </div>
      <div>
        <h3 className="text-base font-black text-white group-hover:text-red-300">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="grid min-h-16 place-items-center content-center px-2 text-center"><strong className="text-sm font-black text-white">{value}</strong><span className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</span></div>;
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("da-DK", { hour: "2-digit", hour12: false, timeZone: "Europe/Copenhagen" }).format(new Date()));
  if (hour < 10) return "Godmorgen";
  if (hour < 18) return "Goddag";
  return "Godaften";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function roleLabel(role: string) {
  if (role === "BRANDFIGHTER") return "Brandmand";
  if (role === "VC") return "VC";
  return "Admin";
}

function vagtHref(role: string) {
  if (role === "BRANDFIGHTER") return "/brandmand";
  if (role === "VC") return "/vagtcentral";
  return "/admin";
}

function notificationHref(role: string) {
  return role === "VC" ? "/vagtcentral/notifikationer" : "/brandmand/notifikationer";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }).format(date);
}

function formatDateTime(date: Date | null) {
  if (!date) return "Ikke fastlagt";
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }).format(date);
}
