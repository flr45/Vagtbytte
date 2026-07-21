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

  it("loading bruger skeletons frem for spinner", () => {
    const source = readFileSync("src/app/loading.tsx", "utf8");

    expect(source).toContain("animate-pulse");
    expect(source).not.toContain("spinner");
  });
});
