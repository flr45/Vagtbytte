import { describe, expect, it } from "vitest";
import { copyName, hasExactIdSet } from "./operativ-admin-utils";

describe("Operativ Portal admin utils", () => {
  it("accepterer samme id-sæt i ny rækkefølge", () => {
    expect(hasExactIdSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("afviser manglende eller duplikerede id'er", () => {
    expect(hasExactIdSet(["a", "b"], ["a"])).toBe(false);
    expect(hasExactIdSet(["a", "b"], ["a", "a"])).toBe(false);
  });

  it("giver kopier et tydeligt navn", () => {
    expect(copyName("Højre forreste rum")).toBe("Højre forreste rum – kopi");
  });
});
