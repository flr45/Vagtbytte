import { afterEach, describe, expect, it } from "vitest";
import {
  canManagePushSubscription,
  canReadNotification,
  endpointHost,
  publicKeyFingerprint,
  sendPushForNotification,
  setPushSenderForTests,
  markAllRead,
  markRead,
  pushUrgencyForNotificationType
} from "./notifications";

afterEach(() => {
  setPushSenderForTests(null);
});

describe("notifikationer - adgang", () => {
  it("en bruger kan kun se egne notifikationer", () => {
    expect(canReadNotification({ userId: "a", recipientUserId: "a" })).toBe(true);
    expect(canReadNotification({ userId: "brandmand", recipientUserId: "vc" })).toBe(false);
  });

  it("brandmand kan ikke se VC's notifikationer", () => {
    expect(canReadNotification({ userId: "brandmand", recipientUserId: "vc" })).toBe(false);
  });

  it("VC kan ikke se en brandmands personlige notifikationer", () => {
    expect(canReadNotification({ userId: "vc", recipientUserId: "brandmand" })).toBe(false);
  });
});

describe("notifikationer - læst", () => {
  it("markering som læst virker", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    expect(markRead({ readAt: null }, now).readAt).toBe(now);
  });

  it("markér alle som læst virker", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    expect(markAllRead([{ readAt: null }, { readAt: null }], now).every((item) => item.readAt === now)).toBe(true);
  });
});

describe("push-enheder", () => {
  it("en bruger kan registrere flere push-enheder", () => {
    const endpoints = new Set(["https://push.test/1", "https://push.test/2"]);
    expect(endpoints.size).toBe(2);
  });

  it("en bruger kan fjerne egen enhed", () => {
    expect(canManagePushSubscription({ userId: "a", subscriptionUserId: "a" })).toBe(true);
  });

  it("en bruger kan ikke fjerne en anden brugers enhed", () => {
    expect(canManagePushSubscription({ userId: "a", subscriptionUserId: "b" })).toBe(false);
  });

  it("udleder kun host fra push-endpoint", () => {
    expect(endpointHost("https://updates.push.services.mozilla.com/wpush/v2/hemmelig")).toBe(
      "updates.push.services.mozilla.com"
    );
  });

  it("permanent ugyldigt abonnement markeres som tilbagekaldt", async () => {
    const repo = makePushRepo([
      { id: "sub-1", endpoint: "https://push.test/1", p256dh: "key", auth: "auth", revokedAt: null }
    ]);
    setPushSenderForTests(async () => {
      const error = new Error("gone") as Error & { statusCode: number };
      error.statusCode = 410;
      throw error;
    });

    await sendPushForNotification(repo, "notification-1");

    expect(repo.deliveries[0].status).toBe("PERMANENT_FAILURE");
    expect(repo.subscriptions[0].revokedAt).toBeInstanceOf(Date);
  });

  it("midlertidig fejl deaktiverer ikke abonnementet permanent", async () => {
    const repo = makePushRepo([
      { id: "sub-1", endpoint: "https://push.test/1", p256dh: "key", auth: "auth", revokedAt: null }
    ]);
    setPushSenderForTests(async () => {
      const error = new Error("temporary") as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    });

    await sendPushForNotification(repo, "notification-1");

    expect(repo.deliveries[0].status).toBe("FAILED");
    expect(repo.subscriptions[0].revokedAt).toBeNull();
  });

  it("gemmer fulde WebPushError-detaljer i lastError", async () => {
    const repo = makePushRepo([
      { id: "sub-1", endpoint: "https://push.test/path/secret-token", p256dh: "key", auth: "auth", revokedAt: null }
    ]);
    setPushSenderForTests(async () => {
      const error = new Error("Received unexpected response code") as Error & {
        statusCode: number;
        headers: Record<string, string>;
        body: string;
      };
      error.statusCode = 403;
      error.headers = { "content-type": "text/plain" };
      error.body = "invalid vapid token";
      error.stack = "Error stacktrace";
      throw error;
    });

    await sendPushForNotification(repo, "notification-1");

    const parsed = JSON.parse(repo.deliveries[0].lastError ?? "{}");
    expect(parsed).toMatchObject({
      statusCode: 403,
      headers: { "content-type": "text/plain" },
      body: "invalid vapid token",
      endpointHost: "push.test",
      responseText: "invalid vapid token",
      stacktrace: "Error stacktrace",
      originalErrorMessage: "Received unexpected response code"
    });
    expect(parsed.vapid).toMatchObject({
      endpointHost: "push.test",
      publicKeyFingerprint: publicKeyFingerprint()
    });
    expect(repo.deliveries[0].lastError).not.toContain("secret-token");
    expect(repo.deliveries[0].lastError).not.toContain(process.env.VAPID_PRIVATE_KEY ?? "definitely-not-present");
  });

  it("fejl på én push-enhed forhindrer ikke levering til andre enheder", async () => {
    const repo = makePushRepo([
      { id: "sub-1", endpoint: "https://push.test/fail", p256dh: "key", auth: "auth", revokedAt: null },
      { id: "sub-2", endpoint: "https://push.test/ok", p256dh: "key", auth: "auth", revokedAt: null }
    ]);
    setPushSenderForTests(async (input) => {
      if (input.endpoint.includes("fail")) {
        throw new Error("temporary");
      }
    });

    const result = await sendPushForNotification(repo, "notification-1");

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
    expect(repo.deliveries.map((delivery) => delivery.status).sort()).toEqual(["FAILED", "SENT"]);
  });

  it("push-payload indeholder notification-id til åbnet/læst-markering", async () => {
    const repo = makePushRepo([
      { id: "sub-1", endpoint: "https://push.test/ok", p256dh: "key", auth: "auth", revokedAt: null }
    ]);
    const ids: string[] = [];
    setPushSenderForTests(async (input) => {
      ids.push(input.notificationId);
    });

    await sendPushForNotification(repo, "notification-1");

    expect(ids).toEqual(["notification-1"]);
  });

  it("handlingspush sendes med high urgency", () => {
    expect(pushUrgencyForNotificationType("TRANSFER_CREATED")).toBe("high");
    expect(pushUrgencyForNotificationType("TRANSFER_ACTIVATION_REMINDER")).toBe("high");
    expect(pushUrgencyForNotificationType("TEST")).toBe("normal");
  });
});

type TestSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  revokedAt: Date | null;
  lastUsedAt?: Date | null;
};

function makePushRepo(subscriptions: TestSubscription[]) {
  const deliveries: Array<{ status: string; pushSubscriptionId?: string | null; lastError?: string | null }> = [];
  const repo = {
    subscriptions,
    deliveries,
    notification: {
      async findUnique() {
        return {
          id: "notification-1",
          title: "Titel",
          body: "Besked",
          link: "/brandmand/anmodninger/1",
          cancelledAt: null,
          publishedAt: new Date(),
          recipient: { pushSubscriptions: subscriptions }
        };
      }
    },
    pushDelivery: {
      async create({ data }: { data: { status: string; pushSubscriptionId?: string | null; lastError?: string | null } }) {
        deliveries.push(data);
        return data;
      }
    },
    pushSubscription: {
      async update({ where, data }: { where: { id: string }; data: Partial<TestSubscription> }) {
        const subscription = subscriptions.find((item) => item.id === where.id);
        if (subscription) {
          Object.assign(subscription, data);
        }
        return subscription;
      }
    },
    shiftTransfer: {},
    returnRequest: {}
  };

  return repo as unknown as Parameters<typeof sendPushForNotification>[0] & {
    subscriptions: TestSubscription[];
    deliveries: Array<{ status: string; pushSubscriptionId?: string | null; lastError?: string | null }>;
  };
}
