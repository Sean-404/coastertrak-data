import type { Confidence } from "../canonical/provenance.js";

export type ReviewAction = "REVIEW" | "MERGE" | "IGNORE";

export type DuplicateCandidate = {
  type: "POSSIBLE_DUPLICATE";
  entityType: "park" | "coaster";
  entityA: string;
  entityB: string;
  nameA: string;
  nameB: string;
  confidence: Confidence;
  reasons: string[];
  action: ReviewAction;
};

export type CountryConflict = {
  type: "COUNTRY_CONFLICT";
  entityType: "park" | "coaster";
  entityId: string;
  entityName: string;
  expectedCountryCode: string;
  actualCountryCode: string;
  reason: string;
  confidence: Confidence;
  action: ReviewAction;
};

export type SuspiciousValue = {
  type: "SUSPICIOUS_VALUE";
  entityType: "park" | "coaster";
  entityId: string;
  entityName: string;
  field: string;
  value: unknown;
  reason: string;
  confidence: Confidence;
  action: ReviewAction;
};

export type MissingDataItem = {
  type: "MISSING_DATA";
  entityType: "park" | "coaster";
  entityId: string;
  entityName: string;
  /** Primary / first missing field (kept for older consumers). */
  field: string;
  /** All missing fields when multiple (coaster completeness). */
  fields?: string[];
  reason: string;
  action: ReviewAction;
  /** Live CoasterTrak `coasters.id` when known. */
  dbId?: number;
  parkName?: string | null;
  /** Relative public catalog path, e.g. `/coasters/nemesis-123`. */
  publicPath?: string;
};

export type ReviewItem =
  | DuplicateCandidate
  | CountryConflict
  | SuspiciousValue
  | MissingDataItem;

export type ReviewQueue = {
  version: 1;
  generatedAt: string;
  items: ReviewItem[];
};
