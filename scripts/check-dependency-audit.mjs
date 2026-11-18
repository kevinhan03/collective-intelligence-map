import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PICOMATCH_ADVISORY =
  "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const EXCEPTION_EXPIRES = "2026-12-18";

// There is no patched release as of 2026-11-18. Only trusted repository
// patterns are passed to these development tools. See docs/security-hardening.md.
export function checkAudit(
  report,
  lock,
  today = new Date().toISOString().slice(0, 10),
) {
  if (
    report?.auditReportVersion !== 2 ||
    report.error ||
    !report.metadata?.vulnerabilities ||
    !report.vulnerabilities ||
    !lock?.packages
  )
    throw new Error("Missing or invalid npm audit report/lockfile");

  const findings = report.vulnerabilities;
  if (Object.keys(findings).length !== report.metadata.vulnerabilities.total)
    throw new Error("Incomplete npm audit report");
  const exceptions = new Set();
  function accepted(name, seen = new Set()) {
    const finding = findings[name];
    if (
      !finding ||
      seen.has(name) ||
      !Array.isArray(finding.via) ||
      !finding.via.length
    )
      return false;
    if (
      !["info", "low", "moderate", "high", "critical"].includes(
        finding.severity,
      )
    )
      return false;
    if (finding.severity === "critical") return false;
    if (!["high", "critical"].includes(finding.severity)) return true;
    // Never exempt production packages, even if another audit step is omitted.
    if (
      !finding.nodes?.length ||
      !finding.nodes.every((node) => lock.packages[node]?.dev === true)
    )
      return false;
    const path = new Set([...seen, name]);
    return finding.via.every((via) => {
      if (typeof via === "string") return accepted(via, path);
      if (["info", "low", "moderate"].includes(via.severity)) return true;
      if (
        name === "picomatch" &&
        via.name === "picomatch" &&
        via.url === PICOMATCH_ADVISORY &&
        via.severity === "high" &&
        finding.severity === "high" &&
        today < EXCEPTION_EXPIRES &&
        finding.nodes.every((node) =>
          ["2.3.2", "4.0.7"].includes(lock.packages[node].version),
        )
      ) {
        exceptions.add(PICOMATCH_ADVISORY);
        return true;
      }
      return false;
    });
  }
  const blocked = Object.keys(findings).filter((name) => !accepted(name));
  return { blocked, exceptions: [...exceptions] };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = spawnSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.error || ![0, 1].includes(result.status))
      throw result.error ?? new Error(result.stderr || "npm audit failed");
    const report = JSON.parse(result.stdout);
    const lock = JSON.parse(
      readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
    );
    const { blocked, exceptions } = checkAudit(report, lock);
    console.log("All dependency findings:", report.metadata.vulnerabilities);
    for (const advisory of exceptions)
      console.warn(
        `Temporary development-only exception (expires ${EXCEPTION_EXPIRES}): ${advisory}`,
      );
    if (blocked.length)
      throw new Error(`Dependency audit rejected: ${blocked.join(", ")}`);
    console.log("Dependency audit policy passed.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
