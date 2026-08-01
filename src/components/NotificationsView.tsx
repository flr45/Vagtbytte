import type { Notification } from "@prisma/client";
import {
  dismissReadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
  removePushSubscriptionAction
} from "@/lib/actions";
import { hasValidCaseLink, notificationTypeLabel } from "@/lib/vc-dashboard";
import { formatDateTime } from "./TransferSummary";
import { PushManager } from "./PushManager";
import { InboxIcon } from "./Icons";

type SafePushDevice = {
  id: string;
  deviceName: string | null;
  lastUsedAt: Date | null;
};

export function NotificationsView({
  notifications,
  devices,
  publicKey,
  latestDelivery,
  showTechnicalDetails = false
}: {
  title: string;
  notifications: Notification[];
  devices: SafePushDevice[];
  publicKey?: string;
  latestDelivery?: { status: string; at: string | null } | null;
  showTechnicalDetails?: boolean;
}) {
  const unread = notifications.filter((item) => !item.readAt);
  const read = notifications.filter((item) => item.readAt).slice(0, 25);

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
      <section className="app-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Beskeder</h1>
          <p className="mt-2 text-sm text-zinc-600">{unread.length} ulæste.</p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <button className="app-button-secondary">Læs alle</button>
        </form>
      </section>
      <section className="grid gap-2">
        <h2 className="text-xl font-bold">Ulæste beskeder</h2>
        {unread.length === 0 ? (
          <EmptyState text="Der er ingen nye beskeder." />
        ) : (
          unread.map((notification) => <NotificationRow key={notification.id} notification={notification} unread />)
        )}
      </section>
      <details className="grid gap-3">
        <summary className="cursor-pointer text-xl font-bold">Tidligere beskeder</summary>
        <div className="mt-3 grid gap-2">
          {read.length === 0 ? (
            <EmptyState text="Der er ingen tidligere beskeder." />
          ) : (
            read.map((notification) => <NotificationRow key={notification.id} notification={notification} />)
          )}
          {notifications.filter((item) => item.readAt).length > read.length ? (
            <p className="text-sm text-zinc-600">Vis flere kommer i en senere historikvisning.</p>
          ) : null}
          <form action={dismissReadNotificationsAction}>
            <button className="app-button-secondary w-full sm:w-auto">Ryd læste</button>
          </form>
        </div>
      </details>
      <section className="app-card grid gap-3">
        <h2 className="text-xl font-bold">Notifikationsindstillinger</h2>
        <PushManager
          latestDelivery={latestDelivery}
          publicKey={publicKey}
          serverDeviceCount={devices.length}
          showDiagnostics={showTechnicalDetails}
        />
        {showTechnicalDetails ? (
          <>
            <p className="text-sm text-zinc-600">
              På iPhone kan push kræve, at siden først er installeret på hjemmeskærmen.
            </p>
            <h3 className="text-lg font-bold">Registrerede enheder</h3>
            {devices.length === 0 ? (
              <EmptyState text="Ingen push-enheder endnu." />
            ) : (
              devices.map((device) => (
                <article className="grid gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-4" key={device.id}>
                  <p className="font-bold">{device.deviceName ?? "Browser"}</p>
                  <p className="text-sm text-zinc-600">
                    Seneste aktivitet: {device.lastUsedAt ? formatDateTime(device.lastUsedAt) : "Ikke registreret"}
                  </p>
                  <form action={removePushSubscriptionAction}>
                    <input name="subscriptionId" type="hidden" value={device.id} />
                    <button className="app-button-secondary w-full sm:w-auto">Fjern enhed</button>
                  </form>
                </article>
              ))
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}

function NotificationRow({ notification, unread = false }: { notification: Notification; unread?: boolean }) {
  return (
    <article
      className={`fade-in grid gap-2 rounded-2xl border-l-4 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${
        unread ? "border-l-brand-red border-y border-r border-red-100" : "border-l-zinc-200 border-y border-r border-zinc-100"
      }`}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-zinc-600">
            {unread ? <span className="mr-2 inline-block size-2 rounded-full bg-brand-red" /> : null}
            {notificationTypeLabel(notification.type)}
          </p>
          <h3 className="truncate text-base font-bold">{notification.title}</h3>
          <p className="truncate text-sm text-zinc-700">{notification.body}</p>
          <p className="text-xs text-zinc-500">{formatDateTime(notification.publishedAt ?? notification.createdAt)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {hasValidCaseLink(notification.link) ? (
            <form action={openNotificationAction}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <button className="app-button-primary min-h-11 px-4 text-sm">Åbn sag</button>
            </form>
          ) : null}
          {unread ? (
            <form action={markNotificationReadAction}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <button className="app-button-secondary min-h-11 px-4 text-sm">Læst</button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-card grid place-items-center gap-3 py-8 text-center text-sm text-zinc-600">
      <InboxIcon className="size-9 text-zinc-400" />
      <p>{text}</p>
    </div>
  );
}
