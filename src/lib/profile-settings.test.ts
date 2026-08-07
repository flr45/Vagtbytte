import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SBR Fire App profil og installation", () => {
  it("viser profilredigering fra Mere-siden", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "app", "app", "mere", "page.tsx"), "utf8");
    expect(source).toContain('href="/app/profil"');
    expect(source).toContain("Mine oplysninger");
    expect(source).toContain("E-mail:");
  });

  it("viser installationsguide til både iPhone og Android", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "app", "app", "mere", "page.tsx"), "utf8");
    expect(source).toContain("iPhone / iPad (Safari)");
    expect(source).toContain("Føj til hjemmeskærm");
    expect(source).toContain("Android (Chrome)");
    expect(source).toContain("Føj til startskærm");
  });

  it("har selvbetjente formularer til profil og adgangskode", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "components", "ProfileSettingsForms.tsx"), "utf8");
    expect(source).toContain("updateOwnProfileAction");
    expect(source).toContain("changeOwnPasswordAction");
    expect(source).toContain('name="name"');
    expect(source).toContain('name="email"');
    expect(source).toContain('name="currentPassword"');
    expect(source).toContain('name="newPassword"');
    expect(source).toContain('name="confirmPassword"');
  });

  it("viser ikke brandmands-notifikationer som dødt link for administrator", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "app", "app", "mere", "page.tsx"), "utf8");
    expect(source).toContain('user.role !== "ADMIN"');
    expect(source).toContain('href={notificationPath}');
  });

  it("bruger det fælles professionelle SVG-ikonlag", () => {
    const shell = fs.readFileSync(path.join(process.cwd(), "src", "components", "SbrFireApp.tsx"), "utf8");
    const more = fs.readFileSync(path.join(process.cwd(), "src", "app", "app", "mere", "page.tsx"), "utf8");
    expect(shell).toContain("AppIcon");
    expect(more).toContain('icon="user"');
    expect(more).toContain('icon="bell"');
    expect(more).toContain('icon="truck"');
  });
});
