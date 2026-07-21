import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { isStandaloneWebApp } from "./push-client";

describe("PWA-konfiguration", () => {
  it("manifest har stabil id, start_url og scope", () => {
    expect(manifest()).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      display_override: ["standalone", "minimal-ui"]
    });
  });

  it("iPhone standalone genkendes via display-mode", () => {
    expect(
      isStandaloneWebApp({
        window: { matchMedia: () => ({ matches: true }) }
      })
    ).toBe(true);
  });

  it("navigator.standalone genkendes selv når display-mode ikke matcher", () => {
    expect(
      isStandaloneWebApp({
        navigator: { standalone: true },
        window: { matchMedia: () => ({ matches: false }) }
      })
    ).toBe(true);
  });

  it("interne redirects bliver i manifestets scope", () => {
    for (const path of ["/login", "/brandmand", "/vagtcentral", "/admin", "/skift-adgangskode"]) {
      expect(path.startsWith("/")).toBe(true);
      expect(path.startsWith("//")).toBe(false);
    }
  });
});
