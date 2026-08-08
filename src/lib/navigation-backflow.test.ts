import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("navigation og tilbageflow", () => {
  it("har en genbrugelig tilbageknap i TopBar", () => {
    const topBar = read("src/components/TopBar.tsx");
    expect(topBar).toContain("backHref?: string");
    expect(topBar).toContain("backLabel?: string");
    expect(topBar).toContain('name="back"');
  });

  it("viser tilbageknap på nøglesider uden tidligere header-retur", () => {
    const alarmFeed = read("src/app/brandmand/alarmer/page.tsx");
    const firefighterNotifications = read("src/app/brandmand/notifikationer/page.tsx");
    const vcNotifications = read("src/app/vagtcentral/notifikationer/page.tsx");
    const assignment = read("src/app/brandmand/til-raadighed/[id]/page.tsx");

    expect(alarmFeed).toContain('backHref="/app"');
    expect(firefighterNotifications).toContain('backHref="/app/mere"');
    expect(vcNotifications).toContain('backHref="/app/mere"');
    expect(assignment).toContain('backHref="/brandmand"');
  });

  it("bruger tilbageikon på Operativ-forsiden og som standard i Operativ-headeren", () => {
    const portal = read("src/app/admin/operativ-portal/page.tsx");
    const header = read("src/components/OperationalPortalNav.tsx");

    expect(portal).toContain('aria-label="Tilbage til SBR Fire App"');
    expect(portal).toContain('name="back"');
    expect(header).toContain('const resolvedBackHref = backHref ?? "/app"');
    expect(header).toContain('{right ?? null}');
  });
});
