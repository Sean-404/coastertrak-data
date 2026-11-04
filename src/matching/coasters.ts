import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import { haversineKm } from "../lib/geo.js";
import { normalizeNameForMatch } from "../normalize/name.js";
import { confidenceFromScore, diceCoefficient, type MatchConfidence } from "./similarity.js";
import type { DuplicateCandidate } from "./types.js";

const NAME_SIMILARITY_MIN = 0.86;
const SCALE_CONFLICT_RATIO = 2;
/** Height, speed and length: this many equal values is too many for two separate rides. */
const MIN_IDENTICAL_STATS = 2;
const STAT_TOLERANCE = 0.05;

const CONFIDENCE_RANK: Record<MatchConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** Company suffixes, so "Mack Rides" and "Mack Rides GmbH & Co KG" are one manufacturer. */
const MANUFACTURER_NOISE = new Set([
  "ag",
  "b",
  "bv",
  "co",
  "company",
  "corp",
  "corporation",
  "gmbh",
  "inc",
  "incorporated",
  "kg",
  "limited",
  "llc",
  "ltd",
  "manufacturing",
  "rides",
  "v",
]);

/** Words that say nothing about which ride a name means. */
const NAME_NOISE = new Set(["coaster", "roller", "the"]);

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function manufacturerKey(value: string | null | undefined): string {
  const words = normalizeNameForMatch(value ?? "").split(" ").filter(Boolean);
  const core = words.filter((word) => !MANUFACTURER_NOISE.has(word));
  return (core.length > 0 ? core : words).join(" ");
}

function nameWords(name: string): string[] {
  return normalizeNameForMatch(name)
    .split(" ")
    .filter((word) => word && !NAME_NOISE.has(word));
}

function yearOf(value: string | null | undefined): number | null {
  const match = /^\d{4}/.exec((value ?? "").trim());
  return match ? Number(match[0]) : null;
}

/**
 * One row closed on or before the other opened: a former version kept on purpose
 * (Mantis / Rougarou, Colossus / Twisted Colossus), or a new ride reusing an old name.
 */
export function isFormerVersionPair(a: CanonicalCoaster, b: CanonicalCoaster): boolean {
  const closedBefore = (older: CanonicalCoaster, newer: CanonicalCoaster) => {
    const closed = yearOf(older.closingDate?.value);
    const opened = yearOf(newer.openingDate?.value);
    return closed != null && opened != null && closed <= opened;
  };
  return closedBefore(a, b) || closedBefore(b, a);
}

function identicalStats(a: CanonicalCoaster, b: CanonicalCoaster): string[] {
  const stats = [
    ["height", a.height?.value.value, b.height?.value.value],
    ["speed", a.speed?.value.value, b.speed?.value.value],
    ["length", a.length?.value.value, b.length?.value.value],
  ] as const;
  return stats
    .filter(([, x, y]) => x != null && y != null && Math.abs(x - y) <= STAT_TOLERANCE)
    .map(([label]) => label);
}

function oneNameContainsTheOther(a: CanonicalCoaster, b: CanonicalCoaster): boolean {
  const wordsA = nameWords(a.name.value);
  const wordsB = nameWords(b.name.value);
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  return shorter.length > 0 && shorter.every((word) => longer.includes(word));
}

/**
 * A ride can be listed under two unrelated-looking names (Eurosat / Eurosat - CanCan Coaster,
 * Top Gun / The Bat), so compare what the rows say about the ride, not only their names.
 */
function sameRideEvidence(
  a: CanonicalCoaster,
  b: CanonicalCoaster,
): { confidence: MatchConfidence; reasons: string[] } | null {
  const reasons: string[] = [];
  let confidence: MatchConfidence | null = null;
  const raise = (level: MatchConfidence) => {
    if (confidence == null || CONFIDENCE_RANK[level] > CONFIDENCE_RANK[confidence]) confidence = level;
  };

  const articleA = norm(a.sourceIds.enwiki);
  if (articleA && articleA === norm(b.sourceIds.enwiki)) {
    reasons.push(`Same Wikipedia article: ${a.sourceIds.enwiki}`);
    raise("HIGH");
  }

  const stats = identicalStats(a, b);
  if (stats.length >= MIN_IDENTICAL_STATS) {
    reasons.push(`Identical ${stats.join(", ")}`);
    raise("MEDIUM");
  }

  const mfrA = manufacturerKey(a.manufacturer?.value);
  if (mfrA && mfrA === manufacturerKey(b.manufacturer?.value) && oneNameContainsTheOther(a, b)) {
    reasons.push("One name contains the other, same manufacturer");
    raise("LOW");
  }

  return confidence ? { confidence, reasons } : null;
}

function measureRatio(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const min = Math.min(Math.abs(a), Math.abs(b));
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (min === 0) return null;
  return max / min;
}

/**
 * Themed cousins at the same park (Beast/Beastie, Mild/Wild Thing, Ravine Flyer II/3)
 * share similar names but are distinct rides. Skip when manufacturers conflict and
 * nothing else reinforces a true duplicate (exact name, shared opening, or proximate coords).
 */
export function areLikelyDistinctSameParkCoasters(
  a: CanonicalCoaster,
  b: CanonicalCoaster,
): boolean {
  const mfrA = manufacturerKey(a.manufacturer?.value);
  const mfrB = manufacturerKey(b.manufacturer?.value);
  if (!mfrA || !mfrB || mfrA === mfrB) return false;

  const nameA = normalizeNameForMatch(a.name.value);
  const nameB = normalizeNameForMatch(b.name.value);
  if (nameA === nameB) return false;

  if (a.openingDate?.value && a.openingDate.value === b.openingDate?.value) return false;

  const coordsA = a.coordinates?.value;
  const coordsB = b.coordinates?.value;
  if (coordsA && coordsB) {
    const km = haversineKm(coordsA.lat, coordsA.lng, coordsB.lat, coordsB.lng);
    if (km <= 0.05) return false;
  }

  const typeA = norm(a.coasterType?.value);
  const typeB = norm(b.coasterType?.value);
  if (typeA && typeB && typeA !== typeB) return true;

  const heightRatio = measureRatio(a.height?.value.value, b.height?.value.value);
  if (heightRatio != null && heightRatio >= SCALE_CONFLICT_RATIO) return true;

  const lengthRatio = measureRatio(a.length?.value.value, b.length?.value.value);
  if (lengthRatio != null && lengthRatio >= SCALE_CONFLICT_RATIO) return true;

  // Different manufacturers + non-exact names, with no reinforcing signal above.
  return true;
}

export function findCoasterDuplicateCandidates(
  coasters: CanonicalCoaster[],
  parksById: Map<string, CanonicalPark>,
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < coasters.length; i++) {
    for (let j = i + 1; j < coasters.length; j++) {
      const a = coasters[i]!;
      const b = coasters[j]!;

      if (a.sourceIds.wikidata && a.sourceIds.wikidata === b.sourceIds.wikidata) continue;

      // Same-named hardware at two parks is a clone / extra install, not a duplicate.
      const samePark = Boolean(a.parkId && a.parkId === b.parkId);
      if (!samePark) continue;
      if (isFormerVersionPair(a, b)) continue;

      const nameA = normalizeNameForMatch(a.name.value);
      const nameB = normalizeNameForMatch(b.name.value);
      const nameScore = diceCoefficient(nameA, nameB);
      const nameMatch = nameScore >= NAME_SIMILARITY_MIN && !areLikelyDistinctSameParkCoasters(a, b);
      const evidence = sameRideEvidence(a, b);
      if (!nameMatch && !evidence) continue;

      const reasons: string[] = [];
      if (nameMatch) reasons.push(`Similar name: ${a.name.value} / ${b.name.value}`);
      reasons.push(...(evidence?.reasons ?? []));
      reasons.push(`Same park: ${a.parkId}`);

      if (
        a.manufacturer?.value &&
        b.manufacturer?.value &&
        manufacturerKey(a.manufacturer.value) === manufacturerKey(b.manufacturer.value)
      ) {
        reasons.push(`Same manufacturer: ${a.manufacturer.value}`);
      }

      if (a.openingDate?.value && a.openingDate.value === b.openingDate?.value) {
        reasons.push(`Same opening date: ${a.openingDate.value}`);
      }

      const coordsA = a.coordinates?.value;
      const coordsB = b.coordinates?.value;
      if (coordsA && coordsB) {
        const km = haversineKm(coordsA.lat, coordsA.lng, coordsB.lat, coordsB.lng);
        if (km <= 0.5) reasons.push(`Coordinates within ${Math.round(km * 1000)}m`);
      }

      const nameConfidence = nameMatch ? confidenceFromScore(nameScore * 0.6 + 0.3 + 0.1) : null;
      const levels = [nameConfidence, evidence?.confidence].filter(
        (level): level is MatchConfidence => level != null,
      );
      const confidence = levels.reduce((best, level) =>
        CONFIDENCE_RANK[level] > CONFIDENCE_RANK[best] ? level : best,
      );

      candidates.push({
        type: "POSSIBLE_DUPLICATE",
        entityType: "coaster",
        entityA: a.id,
        entityB: b.id,
        nameA: a.name.value,
        nameB: b.name.value,
        confidence,
        reasons,
        action: "REVIEW",
      });
    }
  }

  void parksById;
  return candidates;
}

export function findExactCoasterDuplicates(coasters: CanonicalCoaster[]): DuplicateCandidate[] {
  const byWikidata = new Map<string, CanonicalCoaster[]>();
  for (const coaster of coasters) {
    const qid = coaster.sourceIds.wikidata;
    if (!qid) continue;
    const list = byWikidata.get(qid) ?? [];
    list.push(coaster);
    byWikidata.set(qid, list);
  }

  const candidates: DuplicateCandidate[] = [];
  for (const [qid, group] of byWikidata) {
    if (group.length <= 1) continue;
    candidates.push({
      type: "POSSIBLE_DUPLICATE",
      entityType: "coaster",
      entityA: group[0]!.id,
      entityB: group[1]!.id,
      nameA: group[0]!.name.value,
      nameB: group[1]!.name.value,
      confidence: "HIGH",
      reasons: [`Exact Wikidata ID duplicate: ${qid}`],
      action: "REVIEW",
    });
  }
  return candidates;
}
