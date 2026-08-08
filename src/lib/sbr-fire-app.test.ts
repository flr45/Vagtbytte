import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { roleHome } from "./roles";

describe("SBR Fire App unified shell", () => {
  it("bruger den fælles app som startside for alle roller", () => {
    expect(roleHome.BRANDFIGHTER).toBe("/app");
    expect(roleHome.VC).toBe("/app");
    expect(roleHome.ADMIN).toBe("/app");
  });

  it("installerer hele SBR Fire App med root-scope og rolle-sikre shortcuts", () => {
    const manifestPath = path.join(process.cwd(), "public", "manifest.webmanifest");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    expect(manifest.name).toBe("SBR Fire App");
    expect(manifest.start_url).toBe("/app");
    expect(manifest.scope).toBe("/");
    expect(manifest.shortcuts).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "/app" }),
      expect.objectContaining({ url: "/app/alarmer" }),
      expect.objectContaining({ url: "/app/vagt" }),
      expect.objectContaining({ url: "/app/operativ" })
    ]));
    expect(manifest.shortcuts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "/brandmand/alarmer" }),
      expect.objectContaining({ url: "/brandmand" }),
      expect.objectContaining({ url: "/admin/operativ-portal" })
    ]));
  });

  it("sender shortcuts videre efter login, rolle og operativ adgang", () => {
    const alarmSource = fs.readFileSync(path.join(process.cwd(), "src", "app", "app", "alarmer", "page.tsx"), "utf8");
    const vagtSource = fs.readFileSync(path.join(process.cwd(), "src", "app", "app", "vagt", "page.tsx"), "utf8");
    const operativSource = fs.readFileSync(path.join(process.cwd(), "src", "app", "app", "operativ", "page.tsx"), "utf8");

    expect(alarmSource).toContain('user.role === "BRANDFIGHTER" ? "/brandmand/alarmer" : "/app"');
    expect(vagtSource).toContain('redirect("/brandmand")');
    expect(vagtSource).toContain('redirect("/vagtcentral")');
    expect(vagtSource).toContain('redirect("/admin")');
    expect(operativSource).toContain('canAccessOperationalPortal(user) ? "/admin/operativ-portal" : "/app"');
  });

  it("lader Operativ bruge det fælles manifest", () => {
    const layoutPath = path.join(process.cwd(), "src", "app", "admin", "operativ-portal", "layout.tsx");
    const source = fs.readFileSync(layoutPath, "utf8");

    expect(source).toContain('manifest: "/manifest.webmanifest"');
    expect(source).not.toContain('manifest: "/operativ-manifest.webmanifest"');
  });
});
