import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import { haversineKm } from "../lib/geo.js";
import { normalizeNameForMatch } from "../normalize/name.js";
import { confidenceFromScore, diceCoefficient } from "./similarity.js";
import type { DuplicateCandidate } from "./types.js";

const NAME_SIMILARITY_MIN = 0.86;
/** Cross-park name matches need a higher bar — many rides share generic names. */
const CROSS_PARK_NAME_SIMILARITY_MIN = 0.96;

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

      const samePark = Boolean(a.parkId && a.parkId === b.parkId);
      const nameA = normalizeNameForMatch(a.name.value);
      const nameB = normalizeNameForMatch(b.name.value);
      const nameScore = diceCoefficient(nameA, nameB);
      const minScore = samePark ? NAME_SIMILARITY_MIN : CROSS_PARK_NAME_SIMILARITY_MIN;
      if (nameScore < minScore) continue;

      const reasons: string[] = [`Similar name: ${a.name.value} / ${b.name.value}`];

      if (samePark) {
        reasons.push(`Same park: ${a.parkId}`);
      } else {
        reasons.push("Cross-park name match");
      }

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

      // Cross-park: name alone is never enough (many rides share titles globally).
      if (!samePark && reasons.length <= 2) continue;

      const score = nameScore * 0.6 + (samePark ? 0.3 : 0) + 0.1;
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
