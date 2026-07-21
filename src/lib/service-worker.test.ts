import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

describe("service worker push", () => {
  it("viser altid en notifikation ved push", () => {
    expect(source).toContain("showNotification");
    expect(source).toContain("event.waitUntil");
  });

  it("klik åbner korrekt sag og markerer notificationId som åbnet", () => {
    expect(source).toContain("data.notificationId");
    expect(source).toContain("/api/notifications/open");
    expect(source).toContain("clients.openWindow");
    expect(source).toContain("client.navigate(targetUrl)");
  });
});
