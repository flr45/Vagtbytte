"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  checkPushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushToCurrentDeviceAction
} from "@/lib/actions";
import {
  activateBrowserPush,
  iphoneInstallMessage,
  shouldShowPushActivationButton,
  syncExistingBrowserPush
} from "@/lib/push-client";
import { ActionMessage } from "./ActionMessage";

export function PushManager({
  publicKey,
  serverDeviceCount = 0,
  latestDelivery,
  showDiagnostics = false
}: {
  publicKey?: string;
  serverDeviceCount?: number;
  latestDelivery?: { status: string; at: string | null } | null;
  showDiagnostics?: boolean;
}) {
  const [message, setMessage] = useState<string>();
  const [ok, setOk] = useState<boolean>();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [serviceWorkerActive, setServiceWorkerActive] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [serverRegistrationActive, setServerRegistrationActive] = useState(false);
  const [invalidSubscription, setInvalidSubscription] = useState(false);
  const [endpoint, setEndpoint] = useState<string>();
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [displayModeStandalone, setDisplayModeStandalone] = useState(false);
  const [navigatorStandalone, setNavigatorStandalone] = useState(false);
  const [serviceWorkerState, setServiceWorkerState] = useState("Ikke aktiv");
  const [serviceWorkerScope, setServiceWorkerScope] = useState("Ikke registreret");
  const [manifestFound, setManifestFound] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activatePush = useCallback(
    async (forceNewSubscription = false) => {
      setMessage(undefined);
      const result = await activateBrowserPush({
        publicKey,
        forceNewSubscription,
        saveSubscription: savePushSubscriptionAction
      });
      setOk(Boolean(result.ok));
      setMessage(result.message);
      if (result.ok) {
        setPermission("granted");
        setServiceWorkerActive(true);
        setServiceWorkerState("activated");
        setHasSubscription(true);
        setServerRegistrationActive(true);
        setInvalidSubscription(false);
        setEndpoint("endpoint" in result ? result.endpoint : undefined);
      } else if (Notification.permission === "denied") {
        setPermission("denied");
      }
    },
    [publicKey]
  );

  useEffect(() => {
    async function checkExistingSubscription() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPermission("unsupported");
        return;
      }
      const standaloneByDisplayMode = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
      const standaloneByNavigator = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setDisplayModeStandalone(standaloneByDisplayMode);
      setNavigatorStandalone(standaloneByNavigator);
      setManifestFound(Boolean(document.querySelector('link[rel="manifest"]')));
      setInstallMessage(
        standaloneByDisplayMode || standaloneByNavigator ? null : iphoneInstallMessage(navigator.userAgent)
      );
      setPermission(Notification.permission);
      const result = await syncExistingBrowserPush({
        checkSubscription: checkPushSubscriptionAction,
        saveSubscription: savePushSubscriptionAction
      });
      setServiceWorkerActive(result.active);
      setServiceWorkerState(result.serviceWorkerState ?? (result.active ? "activated" : "Ikke aktiv"));
      setServiceWorkerScope(result.serviceWorkerScope ?? "Ikke registreret");
      setHasSubscription(result.subscription);
      setServerRegistrationActive(Boolean(result.serverRegistration));
      setInvalidSubscription(Boolean(result.invalidSubscription));
      if (result.subscription) {
        setEndpoint(result.endpoint);
      }
      if (result.invalidSubscription) {
        await activatePush(true);
      }
    }
    void checkExistingSubscription();
  }, [activatePush]);

  const fullyActive =
    permission === "granted" && serviceWorkerActive && hasSubscription && serverRegistrationActive;
  const canShowActivationButton =
    shouldShowPushActivationButton({
      permission,
      serviceWorkerActive,
      hasSubscription,
      serverRegistrationActive
    }) && !invalidSubscription;

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
      {fullyActive ? (
        <p className="text-sm font-semibold text-emerald-800">Push-notifikationer er aktive på denne enhed.</p>
      ) : invalidSubscription ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Push-abonnementet på denne enhed er ikke længere gyldigt. Aktivér igen for at oprette et nyt.
        </p>
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
        {canShowActivationButton ? (
          <button
            className="focus-ring min-h-12 rounded-md bg-brand-red px-5 text-base font-semibold text-white"
            onClick={() => activatePush(false)}
            type="button"
          >
            Aktivér push-notifikationer
          </button>
        ) : null}
        {invalidSubscription && permission !== "denied" ? (
          <button
            className="focus-ring min-h-12 rounded-md border border-brand-red px-5 text-base font-semibold text-brand-red"
            onClick={() => activatePush(true)}
            type="button"
          >
            Aktivér igen
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
      {showDiagnostics ? (
        <div className="grid gap-1 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
          <p>Browserpermission: {permissionLabel(permission)}</p>
          <p>display-mode standalone: {displayModeStandalone ? "Ja" : "Nej"}</p>
          <p>Standalone: {displayModeStandalone || navigatorStandalone ? "Ja" : "Nej"}</p>
          <p>navigator.standalone: {navigatorStandalone ? "Ja" : "Nej"}</p>
          <p>display-mode: {displayModeStandalone ? "standalone" : "andet"}</p>
          <p>Manifest fundet: {manifestFound ? "Ja" : "Nej"}</p>
          <p>Notification.permission: {permission}</p>
          <p>Service worker: {serviceWorkerActive ? "Aktiv" : "Ikke aktiv"}</p>
          <p>Service worker state: {serviceWorkerState}</p>
          <p>Service worker scope: {serviceWorkerScope}</p>
          <p>Lokal subscription endpoint: {endpoint ? "Findes" : "Findes ikke"}</p>
          <p>Pushsubscription på denne enhed: {hasSubscription ? "Aktiv" : "Mangler"}</p>
          <p>Serverregistrering: {serverRegistrationActive ? "Findes" : "Findes ikke"}</p>
          <p>Registrerede enheder i alt: {serverDeviceCount}</p>
          <p>
            Seneste testnotifikation:{" "}
            {latestDelivery?.at ? `${latestDelivery.status} ${latestDelivery.at}` : "Ingen registreret"}
          </p>
        </div>
      ) : null}
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
