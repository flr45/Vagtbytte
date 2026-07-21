"use client";

import { useEffect, useState, useTransition } from "react";
import { savePushSubscriptionAction, sendTestPushToCurrentDeviceAction } from "@/lib/actions";
import {
  activateBrowserPush,
  iphoneInstallMessage,
  syncExistingBrowserPush
} from "@/lib/push-client";
import { ActionMessage } from "./ActionMessage";

export function PushManager({
  publicKey,
  serverDeviceCount = 0,
  latestDelivery
}: {
  publicKey?: string;
  serverDeviceCount?: number;
  latestDelivery?: { status: string; at: string | null } | null;
}) {
  const [message, setMessage] = useState<string>();
  const [ok, setOk] = useState<boolean>();
  const [isActive, setIsActive] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [serviceWorkerActive, setServiceWorkerActive] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [endpoint, setEndpoint] = useState<string>();
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function checkExistingSubscription() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPermission("unsupported");
        return;
      }
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
      setInstallMessage(standalone ? null : iphoneInstallMessage(navigator.userAgent));
      setPermission(Notification.permission);
      const result = await syncExistingBrowserPush({ saveSubscription: savePushSubscriptionAction });
      setServiceWorkerActive(result.active);
      setHasSubscription(result.subscription);
      if (result.subscription) {
        setIsActive(true);
        setEndpoint(result.endpoint);
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
      setServiceWorkerActive(true);
      setHasSubscription(true);
      setEndpoint("endpoint" in result ? result.endpoint : undefined);
    } else if (Notification.permission === "denied") {
      setPermission("denied");
    }
  }

  function sendTest() {
    startTransition(async () => {
      const result = endpoint
        ? await sendTestPushToCurrentDeviceAction(endpoint)
        : { ok: false, message: "Aktivér push på denne enhed først." };
      setOk(Boolean(result.ok));
      setMessage(result.message);
    });
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold">Push-notifikationer</h2>
      {isActive ? (
        <p className="text-sm font-semibold text-emerald-800">Push-notifikationer er aktive på denne enhed.</p>
      ) : installMessage ? (
        <div className="grid gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">{installMessage}</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Åbn siden i Safari.</li>
            <li>Tryk Del.</li>
            <li>Vælg Føj til hjemmeskærm.</li>
            <li>Slå Åbn som webapp til.</li>
            <li>Åbn Vagtbytte fra ikonet på hjemmeskærmen.</li>
            <li>Aktivér push-notifikationer dér.</li>
          </ol>
        </div>
      ) : permission === "denied" ? (
        <p className="text-sm text-zinc-700">
          Push er afvist i browseren. Åbn browserens indstillinger for siden, hvis du vil aktivere det igen.
        </p>
      ) : (
        <p className="text-sm text-zinc-600">Få besked, når du skal reagere på et vagtskifte.</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {!isActive && permission !== "denied" && !installMessage ? (
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
          Send testpush til denne enhed
        </button>
      </div>
      <div className="grid gap-1 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <p>Browserpermission: {permissionLabel(permission)}</p>
        <p>Service worker: {serviceWorkerActive ? "Aktiv" : "Ikke aktiv"}</p>
        <p>Pushsubscription på denne enhed: {hasSubscription ? "Aktiv" : "Mangler"}</p>
        <p>Serverregistrering: {serverDeviceCount > 0 ? "Aktiv" : "Mangler"}</p>
        <p>
          Seneste testnotifikation:{" "}
          {latestDelivery?.at ? `${latestDelivery.status} ${latestDelivery.at}` : "Ingen registreret"}
        </p>
      </div>
      <ActionMessage message={message} ok={ok} />
    </section>
  );
}

function permissionLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") {
    return "Tilladt";
  }
  if (permission === "denied") {
    return "Afvist";
  }
  if (permission === "unsupported") {
    return "Ikke understøttet";
  }
  return "Ikke valgt";
}
