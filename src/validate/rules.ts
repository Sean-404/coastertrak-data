import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import {
  isClosingBeforeOpening,
  isOpeningDateInFuture,
} from "../normalize/dates.js";
import { isValidCoordinates } from "../normalize/coordinates.js";
import { haversineKm } from "../lib/geo.js";
import { findCoasterDuplicateCandidates, findExactCoasterDuplicates } from "../matching/coasters.js";
import { findParkDuplicateCandidates } from "../matching/parks.js";
import type {
  CountryConflict,
  ReviewItem,
  SuspiciousValue,
} from "../matching/types.js";
import type { QualityFinding, QualityReport, ValidateResult } from "./types.js";

/** Conservative upper bounds — flagged as suspicious, not auto-deleted. Documented in README. */
export const STAT_LIMITS = {
  heightM: 160,
  speedMs: 70,
  lengthM: 3000,
  inversions: 14,
  parkCoasterMaxKm: 50,
} as const;

export type ValidateCatalogInput = {
  parks: CanonicalPark[];
  coasters: CanonicalCoaster[];
  sourceRunId: string;
  generatedAt?: string;
};

function countBySeverity(findings: QualityFinding[]) {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

export function validateCatalog(input: ValidateCatalogInput): ValidateResult {
  const findings: QualityFinding[] = [];
  const reviewItems: ReviewItem[] = [];
  const parksById = new Map(input.parks.map((p) => [p.id, p]));
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  for (const park of input.parks) {
    if (!park.sourceIds.wikidata) {
      findings.push({
        severity: "warning",
        code: "missing_wikidata_id",
        message: "Park missing Wikidata source ID",
        entityType: "park",
        entityId: park.id,
        entityName: park.name.value,
      });
    }

    if (!park.coordinates || !isValidCoordinates(park.coordinates.value)) {
      findings.push({
        severity: "warning",
        code: "missing_coordinates",
        message: "Park missing valid coordinates",
        entityType: "park",
        entityId: park.id,
        entityName: park.name.value,
      });
      reviewItems.push({
        type: "MISSING_DATA",
        entityType: "park",
        entityId: park.id,
        entityName: park.name.value,
        field: "coordinates",
        reason: "Park missing valid coordinates",
        action: "REVIEW",
      });
    }
  }

  for (const coaster of input.coasters) {
    if (coaster.sourceIds.wikidata && !/^Q\d+$/i.test(coaster.sourceIds.wikidata)) {
      findings.push({
        severity: "error",
        code: "invalid_wikidata_id",
        message: `Invalid Wikidata id: ${coaster.sourceIds.wikidata}`,
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
      });
    } else if (!coaster.sourceIds.wikidata) {
      findings.push({
        severity: "info",
        code: "missing_wikidata_id",
        message: "Coaster has no Wikidata source ID (legacy database record)",
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
      });
    }

    if (!coaster.parkId) {
      findings.push({
        severity: "error",
        code: "missing_park",
        message: "Coaster missing park linkage",
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
      });
      reviewItems.push({
        type: "MISSING_DATA",
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
        field: "parkId",
        reason: "Coaster missing park linkage",
        action: "REVIEW",
      });
    }

    const park = coaster.parkId ? parksById.get(coaster.parkId) : null;
    if (park && coaster.countryCode) {
      if (coaster.countryCode.value !== park.countryCode.value) {
        findings.push({
          severity: "warning",
          code: "country_conflict",
          message: `Coaster country ${coaster.countryCode.value} differs from park ${park.countryCode.value}`,
          entityType: "coaster",
          entityId: coaster.id,
          entityName: coaster.name.value,
          details: { parkId: park.id, parkName: park.name.value },
        });
        const conflict: CountryConflict = {
          type: "COUNTRY_CONFLICT",
          entityType: "coaster",
          entityId: coaster.id,
          entityName: coaster.name.value,
          expectedCountryCode: park.countryCode.value,
          actualCountryCode: coaster.countryCode.value,
          reason: `Park ${park.name.value} is in ${park.countryCode.value}`,
          confidence: "HIGH",
          action: "REVIEW",
        };
        reviewItems.push(conflict);
      }
    }

    if (park?.coordinates?.value && coaster.coordinates?.value) {
      const km = haversineKm(
        park.coordinates.value.lat,
        park.coordinates.value.lng,
        coaster.coordinates.value.lat,
        coaster.coordinates.value.lng,
      );
      if (km > STAT_LIMITS.parkCoasterMaxKm) {
        findings.push({
          severity: "warning",
          code: "coaster_far_from_park",
          message: `Coaster is ${Math.round(km)}km from associated park`,
          entityType: "coaster",
          entityId: coaster.id,
          entityName: coaster.name.value,
          details: { distanceKm: km, parkId: park.id },
        });
      }
    }

    if (coaster.openingDate && isOpeningDateInFuture(coaster.openingDate.value)) {
      findings.push({
        severity: "warning",
        code: "opening_date_future",
        message: `Opening date far in the future: ${coaster.openingDate.value}`,
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
      });
    }

    if (
      coaster.openingDate &&
      coaster.closingDate &&
      isClosingBeforeOpening(coaster.openingDate.value, coaster.closingDate.value)
    ) {
      findings.push({
        severity: "error",
        code: "closing_before_opening",
        message: "Closing date before opening date",
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
      });
    }

    const height = coaster.height?.value.value;
    if (height != null && (height <= 0 || height > STAT_LIMITS.heightM)) {
      findings.push({
        severity: "warning",
        code: "stat_outlier_height",
        message: `Suspicious height: ${height}m`,
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
      });
      const item: SuspiciousValue = {
        type: "SUSPICIOUS_VALUE",
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
        field: "height",
        value: height,
        reason: `Height ${height}m outside expected range (0–${STAT_LIMITS.heightM}m)`,
        confidence: height > STAT_LIMITS.heightM ? "LOW" : "MEDIUM",
        action: "REVIEW",
      };
      reviewItems.push(item);
    }

    const speed = coaster.speed?.value.value;
    if (speed != null && (speed <= 0 || speed > STAT_LIMITS.speedMs)) {
      findings.push({
        severity: "warning",
        code: "stat_outlier_speed",
        message: `Suspicious speed: ${speed} m/s`,
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
      });
      reviewItems.push({
        type: "SUSPICIOUS_VALUE",
        entityType: "coaster",
        entityId: coaster.id,
        entityName: coaster.name.value,
        field: "speed",
        value: speed,
        reason: `Speed ${speed} m/s outside expected range`,
        confidence: "LOW",
        action: "REVIEW",
      });
    }
  }

  const parkDupes = findParkDuplicateCandidates(input.parks);
  for (const dupe of parkDupes) {
    findings.push({
      severity: dupe.confidence === "HIGH" ? "warning" : "info",
      code: "possible_duplicate_park",
      message: `Possible duplicate park: ${dupe.nameA} / ${dupe.nameB}`,
      entityType: "park",
      entityId: dupe.entityA,
      entityName: dupe.nameA,
      details: { entityB: dupe.entityB, reasons: dupe.reasons },
    });
    reviewItems.push(dupe);
  }

  const coasterDupes = [
    ...findExactCoasterDuplicates(input.coasters),
    ...findCoasterDuplicateCandidates(input.coasters, parksById),
  ];
  for (const dupe of coasterDupes) {
    findings.push({
      severity: dupe.confidence === "HIGH" ? "warning" : "info",
      code: "possible_duplicate_coaster",
      message: `Possible duplicate coaster: ${dupe.nameA} / ${dupe.nameB}`,
      entityType: "coaster",
      entityId: dupe.entityA,
      entityName: dupe.nameA,
      details: { entityB: dupe.entityB, reasons: dupe.reasons },
    });
    reviewItems.push(dupe);
  }

  const counts = countBySeverity(findings);
  const report: QualityReport = {
    version: 1,
    generatedAt,
    sourceRunId: input.sourceRunId,
    summary: {
      coasters: input.coasters.length,
      parks: input.parks.length,
      errors: counts.errors,
      warnings: counts.warnings,
      info: counts.info,
      passed:
        input.coasters.length +
        input.parks.length -
        counts.errors -
        counts.warnings,
    },
    findings,
  };

  return {
    report,
    reviewItems,
    passed: counts.errors === 0,
  };
}
