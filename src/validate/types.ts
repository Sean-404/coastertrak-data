export type FindingSeverity = "error" | "warning" | "info";

export type QualityFinding = {
  severity: FindingSeverity;
  code: string;
  message: string;
  entityType?: "park" | "coaster";
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
};

export type QualityReportSummary = {
  coasters: number;
  parks: number;
  errors: number;
  warnings: number;
  info: number;
  passed: number;
};

export type QualityReport = {
  version: 1;
  generatedAt: string;
  sourceRunId: string;
  summary: QualityReportSummary;
  findings: QualityFinding[];
};

export type ValidateResult = {
  report: QualityReport;
  reviewItems: import("../matching/types.js").ReviewItem[];
  passed: boolean;
};
