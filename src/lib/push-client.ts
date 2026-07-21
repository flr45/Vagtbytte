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
  };
  notification: {
    requestPermission(): Promise<NotificationPermission>;
  };
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

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey, browserEnvironment.window.atob)
    });
    const json = subscription.toJSON();

    return saveSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      userAgent: browserEnvironment.navigator.userAgent,
      deviceName: "Browser"
    });
  } catch {
    return {
      ok: false,
      message: SERVICE_WORKER_ACTIVATION_MESSAGE
    };
  }
}
