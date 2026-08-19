export const ALLOWED_PRODUCTION_AUDIT_ADVISORIES = new Set([
  "GHSA-ggr8-5vv4-36mx"
]);

export const ALLOWED_PRODUCTION_AUDIT_PACKAGES = new Set([
  "deepmerge-ts",
  "@prisma/config",
  "prisma"
]);

function advisoryId(entry) {
  if (!entry || typeof entry !== "object") return null;
  const text = `${entry.url ?? ""} ${entry.title ?? ""} ${entry.source ?? ""}`;
  const match = text.match(/GHSA-[0-9a-z-]+/i);
  return match?.[0]?.toUpperCase() ?? null;
}

export function blockingProductionAuditFindings(report) {
  const vulnerabilities = report?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") {
    return [{ package: "audit-report", reason: "npm audit returnerede ikke et forståeligt vulnerability-objekt" }];
  }

  const blocking = [];
  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    const severity = String(vulnerability?.severity ?? "").toLowerCase();
    if (severity !== "high" && severity !== "critical") continue;

    const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];
    const directAdvisories = via.filter((entry) => entry && typeof entry === "object");
    const viaPackages = via.filter((entry) => typeof entry === "string");

    const packageAllowed = ALLOWED_PRODUCTION_AUDIT_PACKAGES.has(packageName);
    const advisoriesAllowed = directAdvisories.every((entry) => {
      const id = advisoryId(entry);
      return Boolean(id && ALLOWED_PRODUCTION_AUDIT_ADVISORIES.has(id));
    });
    const viaPackagesAllowed = viaPackages.every((name) => ALLOWED_PRODUCTION_AUDIT_PACKAGES.has(name));
    const hasKnownChain =
      directAdvisories.some((entry) => ALLOWED_PRODUCTION_AUDIT_ADVISORIES.has(advisoryId(entry))) ||
      viaPackages.length > 0;

    if (!packageAllowed || !advisoriesAllowed || !viaPackagesAllowed || !hasKnownChain) {
      blocking.push({
        package: packageName,
        severity,
        via: via.map((entry) =>
          typeof entry === "string"
            ? entry
            : { id: advisoryId(entry), title: entry?.title ?? "Ukendt advisory", url: entry?.url ?? null }
        )
      });
    }
  }

  return blocking;
}
