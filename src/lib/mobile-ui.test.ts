import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("mobilvisning", () => {
  it("TopBar bruger wrap og safe-area", () => {
    const source = readFileSync("src/components/TopBar.tsx", "utf8");

    expect(source).toContain("flex-wrap");
    expect(source).toContain("safe-area-inset-left");
    expect(source).toContain("safe-area-inset-right");
    expect(source).toContain("min-h-11");
  });

  it("global styling forhindrer vandret overflow", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("overflow-x: hidden");
  });

  it("loading bruger mørke skeletons frem for hvidt flash eller spinner", () => {
    const source = readFileSync("src/app/loading.tsx", "utf8");

    expect(source).toContain("animate-pulse");
    expect(source).toContain("bg-[#070b0e]");
    expect(source).toContain("sbr-fire-skin");
    expect(source).not.toContain("bg-white");
    expect(source).not.toContain("spinner");
  });

  it("SBR-interaktionslaget gør tryk tydelige og plusser kompakte på telefon", () => {
    const css = readFileSync("src/app/sbr-interactions.css", "utf8");

    expect(css).toContain("a[href]:active");
    expect(css).toContain("filter: brightness(0.72)");
    expect(css).toContain(".operativ-hotspot-hit");
    expect(css).toContain(".operativ-hotspot-mark");
    expect(css).toContain("@media (max-width: 639px)");
    expect(css).toContain("32px");
  });
});
