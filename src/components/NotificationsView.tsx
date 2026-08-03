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
  title,
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
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-600">
            {unread.length === 0 ? "Ingen ulæste notifikationer." : `${unread.length} ulæste notifikationer.`}
          </p>
        </div>
        {unread.length > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button className="app-button-secondary w-full sm:w-auto" type="submit">
              Markér alle som læst
            </button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-2">
        <h2 className="text-xl font-bold">Ulæste notifikationer</h2>
        {unread.length === 0 ? (
          <EmptyState text="Der er ingen nye notifikationer." />
        ) : (
          unread.map((notification) => <NotificationRow key={notification.id} notification={notification} unread />)
        )}
      </section>

      <details className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <summary className="focus-ring cursor-pointer rounded-xl text-xl font-bold">Tidligere notifikationer</summary>
        <div className="mt-3 grid gap-2">
          {read.length === 0 ? (
            <EmptyState text="Der er ingen tidligere notifikationer." />
          ) : (
            read.map((notification) => <NotificationRow key={notification.id} notification={notification} />)
          )}
          {notifications.filter((item) => item.readAt).length > read.length ? (
            <p className="text-sm font-semibold text-zinc-600">De 25 seneste læste notifikationer vises.</p>
          ) : null}
          {read.length > 0 ? (
            <form action={dismissReadNotificationsAction}>
              <button className="app-button-secondary w-full sm:w-auto" type="submit">
                Ryd læste
              </button>
            </form>
          ) : null}
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
                    <button className="app-button-secondary w-full sm:w-auto" type="submit">
                      Fjern enhed
                    </button>
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
  const canOpen = hasValidCaseLink(notification.link);

  return (
    <article
      className={`fade-in grid gap-3 rounded-2xl border-l-4 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${
        unread ? "border-l-brand-red border-y border-r border-red-100" : "border-l-zinc-200 border-y border-r border-zinc-100"
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-zinc-600">
            {unread ? <span className="mr-2 inline-block size-2 rounded-full bg-brand-red" /> : null}
            {notificationDisplayType(notification)}
          </p>
          <h3 className="mt-1 break-words text-base font-bold">{notification.title}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-zinc-700">
            {notification.body}
          </p>
          <p className="mt-2 text-xs font-semibold text-zinc-500">
            {formatDateTime(notification.publishedAt ?? notification.createdAt)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canOpen ? (
            <form action={openNotificationAction}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <button className="app-button-primary min-h-11 w-full px-4 text-sm sm:w-auto" type="submit">
                {notificationOpenLabel(notification.link)}
              </button>
            </form>
          ) : null}
          {unread ? (
            <form action={markNotificationReadAction}>
              <input name="notificationId" type="hidden" value={notification.id} />
              <button className="app-button-secondary min-h-11 w-full px-4 text-sm sm:w-auto" type="submit">
                Markér som læst
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function notificationDisplayType(notification: Notification) {
  if (notification.type === "AVAILABILITY_ASSIGNED" && notification.link === "/vagtcentral") {
    return "Ny brandmand til rådighed";
  }
  return notificationTypeLabel(notification.type);
}

function notificationOpenLabel(link: string) {
  if (link.startsWith("/brandmand/alarmer")) {
    return "Åbn alarm";
  }
  if (link === "/vagtcentral") {
    return "Åbn vagtcentral";
  }
  return "Åbn sag";
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-card grid place-items-center gap-3 py-8 text-center text-sm text-zinc-600">
      <InboxIcon className="size-9 text-zinc-400" />
      <p>{text}</p>
    </div>
  );
}
