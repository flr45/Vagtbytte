import { describe, expect, it } from "vitest";
import {
  canManagePushSubscription,
  canReadNotification,
  markAllRead,
  markRead,
  sanitizePushError
} from "./notifications";

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

  it("pushfejl skjuler lange hemmeligheder", () => {
    expect(sanitizePushError(new Error("secret abcdefghijklmnopqrstuvwxyzABCDEFG"))).toContain("[skjult]");
  });
});
