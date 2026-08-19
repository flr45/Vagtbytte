import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("sikkerhedsheaders", () => {
  it("håndhæver en begrænset Content Security Policy", () => {
    const config = read("next.config.ts");
    expect(config).toContain('{ key: "Content-Security-Policy", value: contentSecurityPolicy }');
    expect(config).toContain('"default-src \'self\'"');
    expect(config).toContain('"frame-ancestors \'none\'"');
    expect(config).toContain('"object-src \'none\'"');
    expect(config).toContain('"frame-src https://www.youtube-nocookie.com"');
    expect(config).not.toContain('default-src *');
    expect(config).not.toContain('connect-src *');
  });
});

describe("produktnavn", () => {
  it("bruger SBR Portal i app- og PWA-metadata", () => {
    const layout = read("src/app/layout.tsx");
    const manifest = read("public/manifest.webmanifest");
    const operationalManifest = read("public/operativ-manifest.webmanifest");

    expect(layout).toContain('title: "SBR Portal"');
    expect(manifest).toContain('"name": "SBR Portal"');
    expect(operationalManifest).toContain('"name": "SBR Portal – Operativ"');
    expect(layout).not.toContain("SBR Fire App");
  });
});
