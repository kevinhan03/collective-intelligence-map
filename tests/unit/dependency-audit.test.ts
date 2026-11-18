import { describe, expect, it } from "vitest";
import {
  checkAudit,
  PICOMATCH_ADVISORY,
} from "../../scripts/check-dependency-audit.mjs";

function fixture() {
  return {
    report: {
      auditReportVersion: 2,
      metadata: { vulnerabilities: { total: 2 } },
      vulnerabilities: {
        picomatch: {
          severity: "high",
          nodes: ["node_modules/picomatch"],
          via: [
            { name: "picomatch", severity: "high", url: PICOMATCH_ADVISORY },
          ],
        },
        vitest: {
          severity: "high",
          nodes: ["node_modules/vitest"],
          via: ["picomatch"],
        },
      },
    },
    lock: {
      packages: {
        "node_modules/picomatch": { version: "4.0.7", dev: true },
        "node_modules/vitest": { version: "5.1.0", dev: true },
      },
    },
  };
}

describe("dependency audit policy", () => {
  it("allows the reviewed development advisory and its transitive effects", () => {
    const { report, lock } = fixture();
    expect(checkAudit(report, lock, "2026-11-18")).toEqual({
      blocked: [],
      exceptions: [PICOMATCH_ADVISORY],
    });
  });

  it.each([
    "production",
    "new advisory",
    "new version",
    "critical",
    "expired",
    "missing package",
    "cycle",
  ])("rejects %s findings", (scenario) => {
    const { report, lock } = fixture();
    let today = "2026-11-18";
    if (scenario === "production")
      lock.packages["node_modules/picomatch"].dev = false;
    if (scenario === "new advisory")
      report.vulnerabilities.picomatch.via.push({
        name: "picomatch",
        severity: "high",
        url: "https://github.com/advisories/another",
      });
    if (scenario === "new version")
      lock.packages["node_modules/picomatch"].version = "4.0.8";
    if (scenario === "critical")
      report.vulnerabilities.picomatch.severity = "critical";
    if (scenario === "expired") today = "2026-12-18";
    if (scenario === "missing package")
      report.vulnerabilities.vitest.via = ["missing"];
    if (scenario === "cycle") report.vulnerabilities.vitest.via = ["vitest"];
    expect(checkAudit(report, lock, today).blocked.length).toBeGreaterThan(0);
  });

  it("rejects a production parent even when its child has a development exception", () => {
    const { report, lock } = fixture();
    lock.packages["node_modules/vitest"].dev = false;
    expect(checkAudit(report, lock, "2026-11-18").blocked).toContain("vitest");
  });

  it("allows moderate findings under the existing high severity threshold", () => {
    const { report, lock } = fixture();
    report.vulnerabilities.picomatch.severity = "moderate";
    report.vulnerabilities.picomatch.via[0].severity = "moderate";
    expect(checkAudit(report, lock, "2026-11-18").blocked).toEqual([]);
  });

  it("fails closed on audit service errors and incomplete reports", () => {
    const { report, lock } = fixture();
    expect(() => checkAudit({ error: { code: "ENOAUDIT" } }, lock)).toThrow();
    report.metadata.vulnerabilities.total = 3;
    expect(() => checkAudit(report, lock)).toThrow("Incomplete");
  });
});
