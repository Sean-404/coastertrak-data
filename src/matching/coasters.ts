import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import { haversineKm } from "../lib/geo.js";
import { normalizeNameForMatch } from "../normalize/name.js";
import { confidenceFromScore, diceCoefficient } from "./similarity.js";
import type { DuplicateCandidate } from "./types.js";

const NAME_SIMILARITY_MIN = 0.86;
const SCALE_CONFLICT_RATIO = 2;

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
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
  const mfrA = norm(a.manufacturer?.value);
  const mfrB = norm(b.manufacturer?.value);
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

      const nameA = normalizeNameForMatch(a.name.value);
      const nameB = normalizeNameForMatch(b.name.value);
      const nameScore = diceCoefficient(nameA, nameB);
      if (nameScore < NAME_SIMILARITY_MIN) continue;

      if (areLikelyDistinctSameParkCoasters(a, b)) continue;

      const reasons: string[] = [`Similar name: ${a.name.value} / ${b.name.value}`];
      reasons.push(`Same park: ${a.parkId}`);

      if (
        a.manufacturer?.value &&
        b.manufacturer?.value &&
        a.manufacturer.value === b.manufacturer.value
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

      const score = nameScore * 0.6 + 0.3 + 0.1;
      candidates.push({
        type: "POSSIBLE_DUPLICATE",
        entityType: "coaster",
        entityA: a.id,
        entityB: b.id,
        nameA: a.name.value,
        nameB: b.name.value,
        confidence: confidenceFromScore(score),
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
