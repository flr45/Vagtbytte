import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

describe("service worker push", () => {
  it("viser notifikationer gennem service workeren", () => {
    expect(source).toContain("showNotification");
    expect(source).toContain("event.waitUntil");
  });

  it("filtrerer kun alarmopfølgninger og ikke VC-notifikationer", () => {
    expect(source).toContain("hasPrimaryAlarmMarker");
    expect(source).toContain("isAlarmNotification && !hasPrimaryAlarmMarker");
    expect(source).toContain("(ISL|[ABSKLR])");
  });

  it("klik åbner korrekt sag og markerer notificationId som åbnet", () => {
    expect(source).toContain("data.notificationId");
    expect(source).toContain("/api/notifications/open");
    expect(source).toContain("clients.openWindow(targetUrl)");
    expect(source).toContain("portalWindow.navigate(targetUrl)");
  });
});
