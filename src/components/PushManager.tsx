"use client";

import { useState, useTransition } from "react";
import { savePushSubscriptionAction, sendTestNotificationAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushManager({ publicKey }: { publicKey?: string }) {
  const [message, setMessage] = useState<string>();
  const [ok, setOk] = useState<boolean>();
  const [isPending, startTransition] = useTransition();

  async function activatePush() {
    setMessage(undefined);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setOk(false);
      setMessage("Browseren understøtter ikke push-notifikationer.");
      return;
    }

    if (!publicKey) {
      setOk(false);
      setMessage("Push kan ikke aktiveres, fordi VAPID-public-key mangler.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setOk(false);
      setMessage("Tilladelse afvist.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    const json = subscription.toJSON();
    const result = await savePushSubscriptionAction({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: navigator.userAgent,
      deviceName: "Browser"
    });
    setOk(Boolean(result.ok));
    setMessage(result.message);
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
      <p className="text-sm text-zinc-600">Push er en ekstra kanal. In-app-notifikationer gemmes altid i systemet.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          className="focus-ring min-h-12 rounded-md bg-brand-red px-5 text-base font-semibold text-white"
          onClick={activatePush}
          type="button"
        >
          Aktivér notifikationer
        </button>
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
