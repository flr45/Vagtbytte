import Link from "next/link";
import type { Notification, PushSubscription } from "@prisma/client";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  removePushSubscriptionAction
} from "@/lib/actions";
import { formatDateTime } from "./TransferSummary";
import { PushManager } from "./PushManager";

export function NotificationsView({
  title,
  notifications,
  devices,
  publicKey
}: {
  title: string;
  notifications: Notification[];
  devices: PushSubscription[];
  publicKey?: string;
}) {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
      <section className="flex flex-col gap-3 rounded-lg border border-brand-line bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {notifications.filter((item) => !item.readAt).length} ulæste beskeder.
          </p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <button className="focus-ring min-h-12 rounded-md border border-zinc-300 px-5 font-semibold">
            Markér alle som læst
          </button>
        </form>
      </section>
      <PushManager publicKey={publicKey} />
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Beskeder</h2>
        {notifications.length === 0 ? (
          <p className="rounded-lg border border-brand-line bg-white p-4 text-sm text-zinc-600">
            Du har ingen nye notifikationer.
          </p>
        ) : (
          notifications.map((notification) => (
            <article
              className={`grid gap-3 rounded-lg border p-4 shadow-sm ${
                notification.readAt ? "border-brand-line bg-white" : "border-red-200 bg-red-50"
              }`}
              key={notification.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-zinc-600">{notification.type}</p>
                  <h3 className="mt-1 text-lg font-bold">{notification.title}</h3>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
                  {notification.readAt ? "Læst" : "Ulæst"}
                </span>
              </div>
              <p className="text-sm text-zinc-700">{notification.body}</p>
              <p className="text-xs text-zinc-500">
                {formatDateTime(notification.publishedAt ?? notification.createdAt)}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md bg-brand-red px-5 font-semibold text-white"
                  href={notification.link}
                >
                  Åbn sag
                </Link>
                {!notification.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input name="notificationId" type="hidden" value={notification.id} />
                    <button className="focus-ring min-h-12 rounded-md border border-zinc-300 px-5 font-semibold">
                      Markér som læst
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Registrerede enheder</h2>
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
