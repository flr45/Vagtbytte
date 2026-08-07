import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SBR Fire App PWA", () => {
  it("har et installerbart manifest med korrekt scope og ikoner", () => {
    const manifestPath = path.join(process.cwd(), "public", "operativ-manifest.webmanifest");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    expect(manifest.name).toBe("SBR Fire App");
    expect(manifest.start_url).toBe("/admin/operativ-portal/");
    expect(manifest.scope).toBe("/admin/operativ-portal/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/icon-512.png", sizes: "512x512" })
    ]));
  });

  it("bevarer push og indeholder offline- og opdateringsflow", () => {
    const serviceWorkerPath = path.join(process.cwd(), "public", "sw.js");
    const source = fs.readFileSync(serviceWorkerPath, "utf8");

    expect(source).toContain('self.addEventListener("push"');
    expect(source).toContain('self.addEventListener("notificationclick"');
    expect(source).toContain('type === "SYNC_OPERATIONAL_OFFLINE"');
    expect(source).toContain('type === "SKIP_WAITING"');
    expect(source).toContain("/api/admin/operativ-portal/offline-index");
    expect(source).toContain("/offline-operativ.html");
  });
});
