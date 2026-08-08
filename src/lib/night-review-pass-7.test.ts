import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Operativ navigation accessibility", () => {
  it("bruger Next Link og aria-current i OperativTabs", () => {
    const file = path.join(process.cwd(), "src", "components", "OperationalPortalNav.tsx");
    const source = fs.readFileSync(file, "utf8");

    expect(source).toContain('aria-label="Operativ sektioner"');
    expect(source).toContain('aria-current={item.active ? "page" : undefined}');
    expect(source).not.toContain('<a className={`whitespace-nowrap border-b-2');
  });
});
