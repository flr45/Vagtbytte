import { describe, expect, it, vi } from "vitest";
import { activateBrowserPush, SERVICE_WORKER_ACTIVATION_MESSAGE } from "./push-client";

const publicKey = "AQID";

describe("browser push-registrering", () => {
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
    expect(order).toEqual(["register", "subscribe", "save"]);
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
});

function makeRegistration(order: string[]) {
  const subscribe = vi.fn(async () => {
    order.push("subscribe");
    return {
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
  });

  return {
    active: { state: "activated" },
    subscribe,
    pushManager: { subscribe }
  };
}

function makeEnvironment({
  ready,
  onRegister
}: {
  ready: Promise<ReturnType<typeof makeRegistration>>;
  onRegister?: () => void;
}) {
  return {
    navigator: {
      userAgent: "Vitest",
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
      atob: decodeBase64
    },
    notification: {
      async requestPermission() {
        return "granted" as NotificationPermission;
      }
    }
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
