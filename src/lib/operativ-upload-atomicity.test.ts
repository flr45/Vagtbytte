import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ Portal upload-atomicitet", () => {
  it("gemmer billede og auditlog i samme database-transaktion", () => {
    const route = read("src/app/api/admin/operativ-portal/billeder/route.ts");
    expect(route).toContain("await prisma.$transaction(async (tx) => {");
    expect(route).toContain("await tx.auditLog.create({");
    expect(route).not.toContain("await prisma.auditLog.create({");
  });

  it("gemmer dokument og auditlog i samme database-transaktion", () => {
    const route = read("src/app/api/admin/operativ-portal/dokumenter/route.ts");
    expect(route).toContain("await prisma.$transaction(async (tx) => {");
    expect(route).toContain("await tx.$executeRaw`");
    expect(route).toContain("await tx.auditLog.create({");
    expect(route).not.toContain("await prisma.auditLog.create({");
  });
});
