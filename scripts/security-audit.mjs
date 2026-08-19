import { spawnSync } from "node:child_process";
import {
  ALLOWED_PRODUCTION_AUDIT_ADVISORIES,
  blockingProductionAuditFindings
} from "./security-audit-core.mjs";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

const raw = result.stdout?.trim() || result.stderr?.trim();
let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error("SECURITY_AUDIT_INVALID_JSON");
  console.error(raw || "npm audit returnerede intet output.");
  process.exit(1);
}

const blocking = blockingProductionAuditFindings(report);
if (blocking.length > 0) {
  console.error("SECURITY_AUDIT_BLOCKED");
  console.error(JSON.stringify(blocking, null, 2));
  process.exit(1);
}

const totals = report?.metadata?.vulnerabilities ?? {};
console.log("SECURITY_AUDIT_OK", {
  productionVulnerabilities: totals,
  documentedException: [...ALLOWED_PRODUCTION_AUDIT_ADVISORIES]
});
