import { describe, expect, it } from "vitest";
import { blockingProductionAuditFindings } from "./security-audit-core.mjs";

function report(vulnerabilities) {
  return { vulnerabilities };
}

describe("production security audit", () => {
  it("tillader kun den dokumenterede deepmerge-ts advisory gennem Prisma CLI-kæden", () => {
    const result = blockingProductionAuditFindings(report({
      "deepmerge-ts": {
        severity: "high",
        via: [{
          title: "DeepmergeTS stack exhaustion",
          url: "https://github.com/advisories/GHSA-ggr8-5vv4-36mx"
        }]
      },
      "@prisma/config": { severity: "high", via: ["deepmerge-ts"] },
      prisma: { severity: "high", via: ["@prisma/config"] }
    }));

    expect(result).toEqual([]);
  });

  it("blokerer en ny advisory på Prisma selv", () => {
    const result = blockingProductionAuditFindings(report({
      prisma: {
        severity: "critical",
        via: [{
          title: "Ny kritisk Prisma-fejl",
          url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc"
        }]
      }
    }));

    expect(result).toHaveLength(1);
    expect(result[0].package).toBe("prisma");
  });

  it("blokerer andre high/critical production dependencies", () => {
    const result = blockingProductionAuditFindings(report({
      next: {
        severity: "high",
        via: [{
          title: "Next security issue",
          url: "https://github.com/advisories/GHSA-dddd-eeee-ffff"
        }]
      }
    }));

    expect(result).toHaveLength(1);
    expect(result[0].package).toBe("next");
  });

  it("ignorerer moderate findings i high/critical-gaten", () => {
    expect(blockingProductionAuditFindings(report({
      example: { severity: "moderate", via: [] }
    }))).toEqual([]);
  });
});
