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
  pushManager: {
    getSubscription(): Promise<{
      toJSON(): PushSubscriptionJson;
    } | null>;
    subscribe(input: { userVisibleOnly: true; applicationServerKey: Uint8Array }): Promise<{
      toJSON(): PushSubscriptionJson;
    }>;
  };
};

type BrowserPushEnvironment = {
  navigator: {
    userAgent: string;
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
  window: { matchMedia?(query: string): { matches: boolean } };
  isStandalone?: boolean;
}) {
  return Boolean(environment.isStandalone ?? environment.window.matchMedia?.("(display-mode: standalone)").matches);
}

export function iphoneInstallMessage(userAgent: string) {
  return isIosUserAgent(userAgent)
    ? "På iPhone skal Vagtbytte føjes til hjemmeskærmen, før push-notifikationer kan aktiveres."
    : null;
}

export async function activateBrowserPush({
  publicKey,
  saveSubscription,
  environment
}: {
  publicKey?: string;
  saveSubscription: SavePushSubscription;
  environment?: BrowserPushEnvironment;
}) {
  const browserEnvironment = environment ?? {
    navigator,
    window,
    notification: Notification
  };

  const iosMessage = iphoneInstallMessage(browserEnvironment.navigator.userAgent);
  if (iosMessage && !isStandaloneWebApp(browserEnvironment)) {
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
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey, browserEnvironment.window.atob)
      }));
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
  environment
}: {
  saveSubscription: SavePushSubscription;
  environment?: BrowserPushEnvironment;
}) {
  const browserEnvironment = environment ?? {
    navigator,
    window,
    notification: Notification
  };

  if (!browserEnvironment.navigator.serviceWorker || !browserEnvironment.window.PushManager || !browserEnvironment.notification) {
    return { ok: false, supported: false, permission: "unsupported" as const, active: false, subscription: false };
  }

  const permission = browserEnvironment.notification.permission ?? Notification.permission;
  if (permission !== "granted") {
    return { ok: true, supported: true, permission, active: false, subscription: false };
  }

  try {
    await browserEnvironment.navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const registration = await browserEnvironment.navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!registration.active || !subscription) {
      return { ok: true, supported: true, permission, active: Boolean(registration.active), subscription: false };
    }

    const json = subscription.toJSON();
    await saveSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: browserEnvironment.navigator.userAgent,
      deviceName: "Browser"
    });
    return { ok: true, supported: true, permission, active: true, subscription: true, endpoint: json.endpoint };
  } catch {
    return { ok: false, supported: true, permission, active: false, subscription: false };
  }
}
