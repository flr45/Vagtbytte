import type { Notification, PushSubscription } from "@prisma/client";
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

export function NotificationsView({
  notifications,
  devices,
  publicKey
}: {
  title: string;
  notifications: Notification[];
  devices: PushSubscription[];
  publicKey?: string;
}) {
  const unread = notifications.filter((item) => !item.readAt);
  const read = notifications.filter((item) => item.readAt).slice(0, 25);

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
      <section className="flex flex-col gap-3 border-b border-brand-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Beskeder</h1>
          <p className="mt-2 text-sm text-zinc-600">{unread.length} ulæste beskeder.</p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <button className="focus-ring min-h-12 rounded-md border border-zinc-300 px-5 font-semibold">
            Markér alle som læst
          </button>
        </form>
      </section>
      <PushManager publicKey={publicKey} />
      <section className="grid gap-2">
        <h2 className="text-xl font-bold">Ulæste beskeder</h2>
        {unread.length === 0 ? (
          <p className="rounded-lg border border-brand-line bg-white p-4 text-sm text-zinc-600">
            Du har ingen nye notifikationer.
          </p>
        ) : (
          unread.map((notification) => <NotificationRow key={notification.id} notification={notification} unread />)
        )}
      </section>
      <details className="grid gap-3">
        <summary className="cursor-pointer text-xl font-bold">Tidligere beskeder</summary>
        <div className="mt-3 grid gap-2">
          {read.length === 0 ? (
            <p className="rounded-lg border border-brand-line bg-white p-4 text-sm text-zinc-600">
              Der er ingen tidligere beskeder.
            </p>
          ) : (
            read.map((notification) => <NotificationRow key={notification.id} notification={notification} />)
          )}
          {notifications.filter((item) => item.readAt).length > read.length ? (
            <p className="text-sm text-zinc-600">Vis flere kommer i en senere historikvisning.</p>
          ) : null}
          <form action={dismissReadNotificationsAction}>
            <button className="focus-ring min-h-12 w-full rounded-md border border-zinc-300 px-5 font-semibold sm:w-auto">
              Ryd læste beskeder
            </button>
          </form>
        </div>
      </details>
      <section className="grid gap-3 rounded-lg border border-brand-line bg-white p-4">
        <h2 className="text-xl font-bold">Notifikationsindstillinger</h2>
        <p className="text-sm text-zinc-600">
          På iPhone kan push kræve, at siden først er installeret på hjemmeskærmen.
        </p>
        <h3 className="text-lg font-bold">Registrerede enheder</h3>
        {devices.length === 0 ? (
          <p className="rounded-lg border border-brand-line bg-white p-4 text-sm text-zinc-600">
            Push-notifikationer er ikke aktiveret på nogen enheder.
          </p>
        ) : (
          devices.map((device) => (
            <article className="grid gap-2 rounded-lg border border-brand-line bg-white p-4" key={device.id}>
              <p className="font-bold">{device.deviceName ?? "Browser"}</p>
              <p className="text-sm text-zinc-600">
                Seneste aktivitet: {device.lastUsedAt ? formatDateTime(device.lastUsedAt) : "Ikke registreret"}
              </p>
              <form action={removePushSubscriptionAction}>
                <input name="subscriptionId" type="hidden" value={device.id} />
                <button className="focus-ring min-h-12 w-full rounded-md border border-zinc-300 px-5 font-semibold sm:w-auto">
                  Fjern enhed
                </button>
              </form>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function NotificationRow({ notification, unread = false }: { notification: Notification; unread?: boolean }) {
  return (
    <article
      className={`grid gap-2 border-l-4 bg-white p-3 shadow-sm ${
        unread ? "border-l-brand-red border-y border-r border-red-100" : "border-l-zinc-200 border-y border-r border-brand-line"
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
              <button className="focus-ring min-h-11 rounded-md bg-brand-red px-4 text-sm font-semibold text-white">
                Åbn sag
              </button>
            </form>
          ) : null}
          {unread ? (
            <form action={markNotificationReadAction}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <button className="focus-ring min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-semibold">
                Markér læst
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}
