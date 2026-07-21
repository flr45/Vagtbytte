import { describe, expect, it } from "vitest";
import { findCaseInsensitiveLoginConflicts, normalizeLoginIdentifier } from "./login-identifiers";

describe("loginIdentifiers", () => {
  it("trimmes og gemmes med små bogstaver", () => {
    expect(normalizeLoginIdentifier("  Admin  ")).toBe("admin");
    expect(normalizeLoginIdentifier("VC")).toBe("vc");
  });

  it("finder dubletter med forskellig brug af store og små bogstaver", () => {
    const conflicts = findCaseInsensitiveLoginConflicts([
      { id: "1", loginIdentifier: "Admin" },
      { id: "2", loginIdentifier: "admin" },
      { id: "3", loginIdentifier: "vc" }
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].loginIdentifier).toBe("admin");
  });
});
