import path from "node:path";
import { describe, expect, it } from "vitest";
import { operationalContentDisposition, operationalStoredFilePath } from "./operativ-storage";

describe("operativ filstorage", () => {
  const directory = "/data/operativ-portal/images";

  it("tillader et normalt genereret storage-filnavn", () => {
    expect(operationalStoredFilePath(directory, "550e8400-e29b-41d4-a716-446655440000.jpg")).toBe(
      path.resolve(directory, "550e8400-e29b-41d4-a716-446655440000.jpg")
    );
  });

  it("afviser path traversal, undermapper og absolutte stier", () => {
    expect(() => operationalStoredFilePath(directory, "../hemmelig.env")).toThrow();
    expect(() => operationalStoredFilePath(directory, "mappe/fil.jpg")).toThrow();
    expect(() => operationalStoredFilePath(directory, "/etc/passwd")).toThrow();
    expect(() => operationalStoredFilePath(directory, "..")) .toThrow();
  });

  it("afviser nulbyte og tomme storage-navne", () => {
    expect(() => operationalStoredFilePath(directory, "fil.jpg\0.txt")).toThrow();
    expect(() => operationalStoredFilePath(directory, "   ")).toThrow();
  });

  it("viser kun PDF og billeder inline; Office downloades som attachment", () => {
    expect(operationalContentDisposition("application/pdf", "instruks.pdf")).toBe(
      "inline; filename*=UTF-8''instruks.pdf"
    );
    expect(operationalContentDisposition("image/jpeg", "foto.jpg")).toBe(
      "inline; filename*=UTF-8''foto.jpg"
    );
    expect(
      operationalContentDisposition(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "instruks.docx"
      )
    ).toBe("attachment; filename*=UTF-8''instruks.docx");
  });
});
