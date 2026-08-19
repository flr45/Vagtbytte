export const ALLOWED_PRISMA_CLI_ADVISORY = "GHSA-GGR8-5VV4-36MX";

export const ALLOWED_NEXT_POSTCSS_ADVISORIES = new Set([
  "GHSA-QX2V-QP2M-JG93",
  "GHSA-6G55-P6WH-862Q",
  "GHSA-FXQJ-RQCC-2CMP",
  "GHSA-R28C-9Q8G-F849"
]);

const ALLOWED_PRISMA_CHAIN = new Set([
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

function isAllowedPrismaCliFinding(packageName, vulnerability, directAdvisories, viaPackages) {
  if (!ALLOWED_PRISMA_CHAIN.has(packageName)) return false;
  if (viaPackages.some((name) => !ALLOWED_PRISMA_CHAIN.has(name))) return false;

  if (directAdvisories.length > 0) {
    return directAdvisories.every((entry) => advisoryId(entry) === ALLOWED_PRISMA_CLI_ADVISORY);
  }

  return viaPackages.length > 0;
}

function isAllowedNextBuildPostcssFinding(packageName, vulnerability, directAdvisories, viaPackages) {
  if (packageName !== "postcss" || viaPackages.length > 0 || directAdvisories.length === 0) return false;

  const nodes = Array.isArray(vulnerability?.nodes) ? vulnerability.nodes : [];
  if (nodes.length === 0 || nodes.some((node) => node !== "node_modules/next/node_modules/postcss")) {
    return false;
  }

  return directAdvisories.every((entry) => {
    const id = advisoryId(entry);
    return Boolean(id && ALLOWED_NEXT_POSTCSS_ADVISORIES.has(id));
  });
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

    const allowed =
      isAllowedPrismaCliFinding(packageName, vulnerability, directAdvisories, viaPackages) ||
      isAllowedNextBuildPostcssFinding(packageName, vulnerability, directAdvisories, viaPackages);

    if (!allowed) {
      blocking.push({
        package: packageName,
        severity,
        nodes: Array.isArray(vulnerability?.nodes) ? vulnerability.nodes : [],
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
