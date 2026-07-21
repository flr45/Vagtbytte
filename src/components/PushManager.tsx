"use client";

import { useEffect, useState, useTransition } from "react";
import { savePushSubscriptionAction, sendTestNotificationAction } from "@/lib/actions";
import { activateBrowserPush } from "@/lib/push-client";
import { ActionMessage } from "./ActionMessage";

export function PushManager({ publicKey }: { publicKey?: string }) {
  const [message, setMessage] = useState<string>();
  const [ok, setOk] = useState<boolean>();
  const [isActive, setIsActive] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function checkExistingSubscription() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPermission("unsupported");
        return;
      }
      setPermission(Notification.permission);
      if (Notification.permission !== "granted") {
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        setIsActive(true);
        const json = subscription.toJSON();
        await savePushSubscriptionAction({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          userAgent: navigator.userAgent,
          deviceName: "Browser"
        });
      }
    }
    void checkExistingSubscription();
  }, []);

  async function activatePush() {
    setMessage(undefined);
    const result = await activateBrowserPush({
      publicKey,
      saveSubscription: savePushSubscriptionAction
    });
    setOk(Boolean(result.ok));
    setMessage(result.message);
    if (result.ok) {
      setIsActive(true);
      setPermission("granted");
    } else if (Notification.permission === "denied") {
      setPermission("denied");
    }
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestNotificationAction();
      setOk(Boolean(result.ok));
      setMessage(result.message);
    });
  }

  return (
    <section className="grid gap-3 rounded-lg border border-brand-line bg-white p-4">
      <h2 className="text-xl font-bold">Push-notifikationer</h2>
      {isActive ? (
        <p className="text-sm font-semibold text-emerald-800">Push-notifikationer er aktive på denne enhed.</p>
      ) : permission === "denied" ? (
        <p className="text-sm text-zinc-700">
          Push er afvist i browseren. Åbn browserens indstillinger for siden, hvis du vil aktivere det igen.
        </p>
      ) : (
        <p className="text-sm text-zinc-600">Få besked, når du skal reagere på et vagtskifte.</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {!isActive && permission !== "denied" ? (
          <button
            className="focus-ring min-h-12 rounded-md bg-brand-red px-5 text-base font-semibold text-white"
            onClick={activatePush}
            type="button"
          >
            Aktivér push-notifikationer
          </button>
        ) : null}
        <button
          className="focus-ring min-h-12 rounded-md border border-zinc-300 px-5 text-base font-semibold text-zinc-900"
          disabled={isPending}
          onClick={sendTest}
          type="button"
        >
          Send testnotifikation
        </button>
      </div>
      <ActionMessage message={message} ok={ok} />
    </section>
  );
}
