import type { CanonicalPark } from "../canonical/park.js";
import { haversineKm } from "../lib/geo.js";
import { normalizeNameForMatch } from "../normalize/name.js";
import { confidenceFromScore, diceCoefficient } from "./similarity.js";
import type { DuplicateCandidate } from "./types.js";

const PROXIMATE_KM = 0.5;
const NAME_SIMILARITY_MIN = 0.86;

export function findParkDuplicateCandidates(parks: CanonicalPark[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < parks.length; i++) {
    for (let j = i + 1; j < parks.length; j++) {
      const a = parks[i]!;
      const b = parks[j]!;

      if (a.sourceIds.wikidata && a.sourceIds.wikidata === b.sourceIds.wikidata) continue;

      const nameA = normalizeNameForMatch(a.name.value);
      const nameB = normalizeNameForMatch(b.name.value);
      const nameScore = diceCoefficient(nameA, nameB);

      const sameCountry = a.countryCode.value === b.countryCode.value;
      let distanceKm: number | null = null;
      const coordsA = a.coordinates?.value;
      const coordsB = b.coordinates?.value;
      if (coordsA && coordsB) {
        distanceKm = haversineKm(coordsA.lat, coordsA.lng, coordsB.lat, coordsB.lng);
      }

      const reasons: string[] = [];
      if (nameScore >= NAME_SIMILARITY_MIN) {
        reasons.push(`Similar name: ${a.name.value} / ${b.name.value}`);
      }
      if (sameCountry) reasons.push(`Same country: ${a.countryCode.value}`);
      if (distanceKm != null && distanceKm <= PROXIMATE_KM) {
        reasons.push(`Coordinates within ${Math.round(distanceKm * 1000)}m`);
      }

      const aliasMatch =
        a.aliases.some((alias) => normalizeNameForMatch(alias) === nameB) ||
        b.aliases.some((alias) => normalizeNameForMatch(alias) === nameA);
      if (aliasMatch) reasons.push("Alias matches other park name");

      if (reasons.length < 2 && nameScore < NAME_SIMILARITY_MIN) continue;

      const score =
        nameScore * 0.5 +
        (sameCountry ? 0.2 : 0) +
        (distanceKm != null && distanceKm <= PROXIMATE_KM ? 0.3 : 0);

      candidates.push({
        type: "POSSIBLE_DUPLICATE",
        entityType: "park",
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

  return candidates;
}
