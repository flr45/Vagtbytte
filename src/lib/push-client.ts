export const SERVICE_WORKER_ACTIVATION_MESSAGE = "Service workeren kunne ikke aktiveres. Genindlæs siden og prøv igen.";

type PushSubscriptionJson = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type ReadyRegistration = {
  active?: unknown;
  scope?: string;
  pushManager: {
    getSubscription(): Promise<{
      toJSON(): PushSubscriptionJson;
      unsubscribe?(): Promise<boolean>;
    } | null>;
    subscribe(input: { userVisibleOnly: true; applicationServerKey: Uint8Array }): Promise<{
      toJSON(): PushSubscriptionJson;
      unsubscribe?(): Promise<boolean>;
    }>;
  };
};

type BrowserPushEnvironment = {
  navigator: {
    userAgent: string;
    standalone?: boolean;
    serviceWorker?: {
      register(scriptUrl: string, options: { scope: string }): Promise<unknown>;
      ready: Promise<ReadyRegistration>;
    };
  };
  window: {
    PushManager?: unknown;
    atob(input: string): string;
    matchMedia?(query: string): { matches: boolean };
  };
  notification: {
    permission?: NotificationPermission;
    requestPermission(): Promise<NotificationPermission>;
  };
  isStandalone?: boolean;
};

type SavePushSubscription = (input: {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  userAgent: string;
  deviceName: string;
}) => Promise<{ ok?: boolean; message?: string }>;

type CheckPushSubscription = (endpoint: string) => Promise<{ ok?: boolean; active?: boolean; message?: string }>;

export function urlBase64ToUint8Array(base64String: string, atobFn: (input: string) => string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atobFn(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isIosUserAgent(userAgent: string) {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile/.test(userAgent));
}

export function isStandaloneWebApp(environment: {
  navigator?: { standalone?: boolean };
  window: { matchMedia?(query: string): { matches: boolean } };
  isStandalone?: boolean;
}) {
  return Boolean(
    environment.isStandalone ||
      environment.navigator?.standalone ||
      environment.window.matchMedia?.("(display-mode: standalone)").matches
  );
}

export function iphoneInstallMessage(userAgent: string) {
  return isIosUserAgent(userAgent)
    ? "På iPhone skal Vagtbytte føjes til hjemmeskærmen, før push-notifikationer kan aktiveres."
    : null;
}

export function shouldShowPushActivationButton(input: {
  permission: NotificationPermission | "unsupported";
  serviceWorkerActive: boolean;
  hasSubscription: boolean;
  serverRegistrationActive: boolean;
}) {
  if (input.permission === "denied" || input.permission === "unsupported") {
    return false;
  }
  return !(
    input.permission === "granted" &&
    input.serviceWorkerActive &&
    input.hasSubscription &&
    input.serverRegistrationActive
  );
}

export async function activateBrowserPush({
  publicKey,
  saveSubscription,
  forceNewSubscription = false,
  environment
}: {
  publicKey?: string;
  saveSubscription: SavePushSubscription;
  forceNewSubscription?: boolean;
  environment?: BrowserPushEnvironment;
}) {
  const browserEnvironment = (environment ?? {
    navigator,
    window,
    notification: Notification
  }) as BrowserPushEnvironment;

  const iosMessage = iphoneInstallMessage(browserEnvironment.navigator.userAgent);
  if (
    iosMessage &&
    !isStandaloneWebApp({
      isStandalone: browserEnvironment.isStandalone,
      navigator: { standalone: browserEnvironment.navigator.standalone },
      window: browserEnvironment.window
    })
  ) {
    return { ok: false, message: iosMessage, needsInstall: true };
  }

  if (!browserEnvironment.navigator.serviceWorker || !browserEnvironment.window.PushManager) {
    return {
      ok: false,
      message: "Browseren understøtter ikke push-notifikationer."
    };
  }

  if (!publicKey) {
    return {
      ok: false,
      message: "Push kan ikke aktiveres, fordi VAPID-public-key mangler."
    };
  }

  const permission = await browserEnvironment.notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      message: "Tilladelse afvist."
    };
  }

  try {
    await browserEnvironment.navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const registration = await browserEnvironment.navigator.serviceWorker.ready;

    if (!registration.active) {
      return {
        ok: false,
        message: SERVICE_WORKER_ACTIVATION_MESSAGE
      };
    }

    const existing = await registration.pushManager.getSubscription();
    if (forceNewSubscription && existing) {
      await existing.unsubscribe?.();
    }
    const subscription =
      forceNewSubscription || !existing
        ? await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey, browserEnvironment.window.atob)
          })
        : existing;
    const json = subscription.toJSON();

    const result = await saveSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: browserEnvironment.navigator.userAgent,
      deviceName: "Browser"
    });
    return { ...result, endpoint: json.endpoint };
  } catch {
    return {
      ok: false,
      message: SERVICE_WORKER_ACTIVATION_MESSAGE
    };
  }
}

export async function syncExistingBrowserPush({
  saveSubscription,
  checkSubscription,
  environment
}: {
  saveSubscription: SavePushSubscription;
  checkSubscription?: CheckPushSubscription;
  environment?: BrowserPushEnvironment;
}) {
  const browserEnvironment = (environment ?? {
    navigator,
    window,
    notification: Notification
  }) as BrowserPushEnvironment;

  if (!browserEnvironment.navigator.serviceWorker || !browserEnvironment.window.PushManager || !browserEnvironment.notification) {
    return {
      ok: false,
      supported: false,
      permission: "unsupported" as const,
      active: false,
      serviceWorkerState: "Ikke aktiv",
      subscription: false,
      serverRegistration: false,
      invalidSubscription: false
    };
  }

  const permission = browserEnvironment.notification.permission ?? Notification.permission;
  if (permission !== "granted") {
    return {
      ok: true,
      supported: true,
      permission,
      active: false,
      serviceWorkerState: "Ikke aktiv",
      subscription: false,
      serverRegistration: false,
      invalidSubscription: false
    };
  }

  try {
    await browserEnvironment.navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const registration = await browserEnvironment.navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!registration.active || !subscription) {
      return {
        ok: true,
        supported: true,
        permission,
        active: Boolean(registration.active),
        serviceWorkerState: registration.active ? "activated" : "Ikke aktiv",
        serviceWorkerScope: registration.scope,
        subscription: false,
        serverRegistration: false,
        invalidSubscription: false
      };
    }

    const json = subscription.toJSON();
    if (checkSubscription && json.endpoint) {
      const serverStatus = await checkSubscription(json.endpoint);
      if (!serverStatus.active) {
        await subscription.unsubscribe?.();
        return {
          ok: true,
          supported: true,
          permission,
          active: true,
          serviceWorkerState: "activated",
          serviceWorkerScope: registration.scope,
          subscription: false,
          serverRegistration: false,
          invalidSubscription: true,
          endpoint: json.endpoint
        };
      }
    }

    await saveSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: browserEnvironment.navigator.userAgent,
      deviceName: "Browser"
    });
    return {
      ok: true,
      supported: true,
      permission,
      active: true,
      serviceWorkerState: "activated",
      serviceWorkerScope: registration.scope,
      subscription: true,
      serverRegistration: true,
      invalidSubscription: false,
      endpoint: json.endpoint
    };
  } catch {
    return {
      ok: false,
      supported: true,
      permission,
      active: false,
      serviceWorkerState: "Ikke aktiv",
      subscription: false,
      serverRegistration: false,
      invalidSubscription: false
    };
  }
}
