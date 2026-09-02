import type { QualityReport } from "./types.js";

export function renderQualityReportMarkdown(report: QualityReport): string {
  const lines: string[] = [
    "CoasterTrak Data Quality Report",
    "================================",
    "",
    `Generated: ${report.generatedAt}`,
    `Source run: ${report.sourceRunId}`,
    "",
    `Coasters: ${report.summary.coasters}`,
    `Parks: ${report.summary.parks}`,
    "",
    `Errors: ${report.summary.errors}`,
    `Warnings: ${report.summary.warnings}`,
    `Info: ${report.summary.info}`,
    "",
  ];

  const errors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const info = report.findings.filter((f) => f.severity === "info");

  if (errors.length > 0) {
    lines.push("ERRORS", "------", "");
    for (const f of errors) {
      lines.push(`[${(f.entityType ?? "GENERAL").toUpperCase()}] ${f.message}`);
      if (f.entityName) lines.push(`  ${f.entityName} (${f.entityId ?? "?"})`);
      lines.push("");
    }
  }

  if (warnings.length > 0) {
    lines.push("WARNINGS", "--------", "");
    for (const f of warnings) {
      lines.push(`[${(f.entityType ?? "GENERAL").toUpperCase()}] ${f.message}`);
      if (f.entityName) lines.push(`  ${f.entityName} (${f.entityId ?? "?"})`);
      lines.push("");
    }
  }

  if (info.length > 0) {
    lines.push("INFO", "----", "");
    for (const f of info) {
      lines.push(`[${(f.entityType ?? "GENERAL").toUpperCase()}] ${f.message}`);
      if (f.entityName) lines.push(`  ${f.entityName} (${f.entityId ?? "?"})`);
      lines.push("");
    }
  }

  if (report.findings.length === 0) {
    lines.push("No findings — all checks passed.");
  }

  return lines.join("\n");
}

export function renderQualityReportText(report: QualityReport): string {
  return renderQualityReportMarkdown(report);
}
