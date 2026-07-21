"use client";

import { useState, useTransition } from "react";
import { savePushSubscriptionAction, sendTestNotificationAction } from "@/lib/actions";
import { activateBrowserPush } from "@/lib/push-client";
import { ActionMessage } from "./ActionMessage";

export function PushManager({ publicKey }: { publicKey?: string }) {
  const [message, setMessage] = useState<string>();
  const [ok, setOk] = useState<boolean>();
  const [isPending, startTransition] = useTransition();

  async function activatePush() {
    setMessage(undefined);
    const result = await activateBrowserPush({
      publicKey,
      saveSubscription: savePushSubscriptionAction
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
