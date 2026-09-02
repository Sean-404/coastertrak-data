import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import type { Confidence } from "../canonical/provenance.js";
import type { QualityFinding } from "../validate/types.js";

function downgrade(current: Confidence | undefined, next: Confidence): Confidence {
  const order: Confidence[] = ["HIGH", "MEDIUM", "LOW"];
  if (!current) return next;
  return order[Math.max(order.indexOf(current), order.indexOf(next))]!;
}

export function scoreParkQuality(
  park: CanonicalPark,
  findings: QualityFinding[],
): CanonicalPark {
  const parkFindings = findings.filter((f) => f.entityId === park.id);
  let qualityScore: Confidence = "HIGH";
  const reviewReasons: string[] = [...park.verification.reviewReasons];

  for (const f of parkFindings) {
    if (f.severity === "error") qualityScore = "LOW";
    else if (f.severity === "warning") qualityScore = downgrade(qualityScore, "MEDIUM");
    reviewReasons.push(f.message);
  }

  return {
    ...park,
    verification: {
      qualityScore,
      needsReview: qualityScore !== "HIGH" || park.verification.needsReview,
      reviewReasons: [...new Set(reviewReasons)],
    },
  };
}

export function scoreCoasterQuality(
  coaster: CanonicalCoaster,
  findings: QualityFinding[],
): CanonicalCoaster {
  const coasterFindings = findings.filter((f) => f.entityId === coaster.id);
  let qualityScore: Confidence = "HIGH";
  const reviewReasons: string[] = [...coaster.verification.reviewReasons];

  if (!coaster.parkId) {
    qualityScore = "LOW";
    reviewReasons.push("Missing park linkage");
  }
  if (!coaster.height && !coaster.speed && !coaster.length) {
    qualityScore = downgrade(qualityScore, "MEDIUM");
  }

  for (const f of coasterFindings) {
    if (f.severity === "error") qualityScore = "LOW";
    else if (f.severity === "warning") qualityScore = downgrade(qualityScore, "MEDIUM");
    reviewReasons.push(f.message);
  }

  if (coaster.height?.confidence === "LOW" || coaster.speed?.confidence === "LOW") {
    qualityScore = downgrade(qualityScore, "LOW");
  }

  return {
    ...coaster,
    verification: {
      qualityScore,
      needsReview: qualityScore !== "HIGH" || coaster.verification.needsReview,
      reviewReasons: [...new Set(reviewReasons)],
    },
  };
}

export function applyQualityScores(
  parks: CanonicalPark[],
  coasters: CanonicalCoaster[],
  findings: QualityFinding[],
): { parks: CanonicalPark[]; coasters: CanonicalCoaster[] } {
  return {
    parks: parks.map((p) => scoreParkQuality(p, findings)),
    coasters: coasters.map((c) => scoreCoasterQuality(c, findings)),
  };
}
