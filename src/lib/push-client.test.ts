import { describe, expect, it, vi } from "vitest";
import {
  activateBrowserPush,
  SERVICE_WORKER_ACTIVATION_MESSAGE,
  shouldShowPushActivationButton,
  syncExistingBrowserPush
} from "./push-client";

const publicKey = "AQID";

describe("browser push-registrering", () => {
  it("viser aktiveringsknappen når mindst ét pushkrav mangler", () => {
    expect(
      shouldShowPushActivationButton({
        permission: "default",
        serviceWorkerActive: false,
        hasSubscription: false,
        serverRegistrationActive: false
      })
    ).toBe(true);
    expect(
      shouldShowPushActivationButton({
        permission: "granted",
        serviceWorkerActive: true,
        hasSubscription: true,
        serverRegistrationActive: false
      })
    ).toBe(true);
  });

  it("skjuler kun aktiveringsknappen når alle pushkrav er opfyldt", () => {
    expect(
      shouldShowPushActivationButton({
        permission: "granted",
        serviceWorkerActive: true,
        hasSubscription: true,
        serverRegistrationActive: true
      })
    ).toBe(false);
  });

  it("venter på navigator.serviceWorker.ready før subscribe", async () => {
    const order: string[] = [];
    let resolveReady: (registration: ReturnType<typeof makeRegistration>) => void = () => undefined;
    const ready = new Promise<ReturnType<typeof makeRegistration>>((resolve) => {
      resolveReady = resolve;
    });
    const registration = makeRegistration(order);
    const environment = makeEnvironment({ ready, onRegister: () => order.push("register") });

    const resultPromise = activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription(order),
      environment
    });

    await Promise.resolve();
    expect(order).toEqual(["register"]);
    expect(registration.subscribe).not.toHaveBeenCalled();

    resolveReady(registration);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(order).toEqual(["register", "getSubscription", "subscribe", "save"]);
  });

  it("subscribe kaldes med en aktiv registration", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order);
    const environment = makeEnvironment({ ready: Promise.resolve(registration) });

    await activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription(order),
      environment
    });

    expect(registration.subscribe).toHaveBeenCalledOnce();
    expect(registration.active).toEqual({ state: "activated" });
  });

  it("registreringsfejl håndteres uden unhandled exception", async () => {
    const environment = makeEnvironment({
      ready: Promise.resolve(makeRegistration([])),
      onRegister: () => {
        throw new Error("registration failed");
      }
    });

    await expect(
      activateBrowserPush({
        publicKey,
        saveSubscription: makeSaveSubscription([]),
        environment
      })
    ).resolves.toEqual({
      ok: false,
      message: SERVICE_WORKER_ACTIVATION_MESSAGE
    });
  });

  it("manglende browserunderstøttelse vises pænt", async () => {
    const result = await activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription([]),
      environment: {
        navigator: { userAgent: "Test" },
        window: { PushManager: undefined, atob: decodeBase64 },
        notification: { requestPermission: async () => "granted" }
      }
    });

    expect(result).toEqual({
      ok: false,
      message: "Browseren understøtter ikke push-notifikationer."
    });
  });

  it("VAPID-public key anvendes korrekt", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order);
    const environment = makeEnvironment({ ready: Promise.resolve(registration) });

    await activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription(order),
      environment
    });

    expect(registration.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from([1, 2, 3])
    });
  });

  it("eksisterende subscription genbruges uden ny subscribe", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order, true);
    const environment = makeEnvironment({ ready: Promise.resolve(registration) });

    await activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription(order),
      environment
    });

    expect(registration.getSubscription).toHaveBeenCalledOnce();
    expect(registration.subscribe).not.toHaveBeenCalled();
    expect(order).toEqual(["getSubscription", "save"]);
  });

  it("ugyldig serverregistrering unsubscribe'r gammel subscription og gemmer ikke den gamle", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order, true);
    const environment = makeEnvironment({ ready: Promise.resolve(registration) });

    const result = await syncExistingBrowserPush({
      checkSubscription: async () => ({ ok: true, active: false }),
      saveSubscription: makeSaveSubscription(order),
      environment
    });

    expect(result).toMatchObject({
      subscription: false,
      serverRegistration: false,
      invalidSubscription: true
    });
    expect(registration.unsubscribe).toHaveBeenCalledOnce();
    expect(order).toEqual(["getSubscription", "unsubscribe"]);
  });

  it("forceNewSubscription unsubscribe'r gammel subscription før ny subscribe", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order, true);
    const environment = makeEnvironment({ ready: Promise.resolve(registration) });

    const result = await activateBrowserPush({
      publicKey,
      forceNewSubscription: true,
      saveSubscription: makeSaveSubscription(order),
      environment
    });

    expect(result.ok).toBe(true);
    expect(registration.unsubscribe).toHaveBeenCalledOnce();
    expect(registration.subscribe).toHaveBeenCalledOnce();
    expect(order).toEqual(["getSubscription", "unsubscribe", "subscribe", "save"]);
  });

  it("baggrundssynk spørger ikke om permission", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order, true);
    const requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    const environment = makeEnvironment({ ready: Promise.resolve(registration), requestPermission });

    const result = await syncExistingBrowserPush({
      saveSubscription: makeSaveSubscription(order),
      environment
    });

    expect(result.subscription).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("iPhone uden standalone får installationsvejledning", async () => {
    const result = await activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription([]),
      environment: makeEnvironment({
        ready: Promise.resolve(makeRegistration([])),
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        standalone: false
      })
    });

    expect(result).toMatchObject({
      ok: false,
      needsInstall: true,
      message: "På iPhone skal Vagtbytte føjes til hjemmeskærmen, før push-notifikationer kan aktiveres."
    });
  });

  it("standalone iPhone kan abonnere", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order);

    const result = await activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription(order),
      environment: makeEnvironment({
        ready: Promise.resolve(registration),
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        standalone: true
      })
    });

    expect(result.ok).toBe(true);
    expect(registration.subscribe).toHaveBeenCalledOnce();
  });

  it("iPhone med navigator.standalone kan abonnere selv hvis display-mode ikke matcher", async () => {
    const order: string[] = [];
    const registration = makeRegistration(order);

    const result = await activateBrowserPush({
      publicKey,
      saveSubscription: makeSaveSubscription(order),
      environment: makeEnvironment({
        ready: Promise.resolve(registration),
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        standalone: false,
        navigatorStandalone: true
      })
    });

    expect(result.ok).toBe(true);
    expect(registration.subscribe).toHaveBeenCalledOnce();
  });
});

function makeRegistration(order: string[], existing = false) {
  const unsubscribe = vi.fn(async () => {
    order.push("unsubscribe");
    return true;
  });
  const subscriptionJson = {
    unsubscribe,
    toJSON() {
      return {
        endpoint: "https://push.test/sub",
        keys: {
          p256dh: "p256dh",
          auth: "auth"
        }
      };
    }
  };
  const getSubscription = vi.fn(async () => {
    order.push("getSubscription");
    return existing ? subscriptionJson : null;
  });
  const subscribe = vi.fn(async () => {
    order.push("subscribe");
    return subscriptionJson;
  });

  return {
    active: { state: "activated" },
    unsubscribe,
    getSubscription,
    subscribe,
    pushManager: { getSubscription, subscribe }
  };
}

function makeEnvironment({
  ready,
  onRegister,
  requestPermission,
  userAgent = "Vitest",
  standalone = false,
  navigatorStandalone = false
}: {
  ready: Promise<ReturnType<typeof makeRegistration>>;
  onRegister?: () => void;
  requestPermission?: () => Promise<NotificationPermission>;
  userAgent?: string;
  standalone?: boolean;
  navigatorStandalone?: boolean;
}) {
  return {
    navigator: {
      userAgent,
      standalone: navigatorStandalone,
      serviceWorker: {
        async register(scriptUrl: string, options: { scope: string }) {
          expect(scriptUrl).toBe("/sw.js");
          expect(options).toEqual({ scope: "/" });
          onRegister?.();
        },
        ready
      }
    },
    window: {
      PushManager: function PushManager() {
        return undefined;
      },
      atob: decodeBase64,
      matchMedia() {
        return { matches: standalone };
      }
    },
    notification: {
      permission: "granted" as NotificationPermission,
      requestPermission: requestPermission ?? (async function requestPermission() {
        return "granted" as NotificationPermission;
      })
    },
    isStandalone: standalone
  };
}

function makeSaveSubscription(order: string[]) {
  return async () => {
    order.push("save");
    return {
      ok: true,
      message: "Push-notifikationer er aktiveret."
    };
  };
}

function decodeBase64(input: string) {
  return Buffer.from(input, "base64").toString("binary");
}
