import { normalizeNameForMatch } from "../normalize/name.js";

/**
 * Wikipedia/Wikidata labels often carry a disambiguator naming the coaster's park,
 * e.g. "Wildcat (Jolly Roger Amusement Park)". When that disambiguator names a
 * different park than the one the row is linked to, the row is probably a
 * different installation attached to the wrong park.
 */

/** Disambiguators that describe the ride, not where it is. */
const GENERIC_DISAMBIGUATOR =
  /^(?:\d{4}(?:\s+\w+)*|.*\b(?:roller\s*coaster|coaster|ride|attraction|wooden|steel|launched|inverted|ride\s+type|model|wild\s+mouse|bobsled|mine\s+train|family|kiddie|junior|clone|relocated)\b.*)$/i;

/** Tokens too common in park names to signal a match on their own. */
const WEAK_TOKENS = new Set([
  "park",
  "parks",
  "the",
  "of",
  "and",
  "at",
  "land",
  "world",
  "kingdom",
  "adventure",
  "adventures",
  "fun",
  "city",
  "gardens",
  "pleasure",
  "beach",
  "pier",
  "studios",
  "island",
  "flags",
  "six",
]);

function strongTokens(text: string): string[] {
  return normalizeNameForMatch(text)
    .split(" ")
    .filter((t) => t.length > 1 && !WEAK_TOKENS.has(t));
}

/** Trailing "(…)" disambiguator, if any. */
export function trailingDisambiguator(name: string): string | null {
  const m = name.trim().match(/\(([^()]+)\)\s*$/);
  return m ? m[1]!.trim() : null;
}

/**
 * Returns the disambiguator when it looks like a place that is NOT the linked park;
 * null when there is no disambiguator, it is generic, or it matches the park.
 */
export function mismatchedParkDisambiguator(coasterName: string, parkNames: string[]): string | null {
  const dis = trailingDisambiguator(coasterName);
  if (!dis || GENERIC_DISAMBIGUATOR.test(dis)) return null;

  const disTokens = strongTokens(dis);
  if (disTokens.length === 0) return null;

  const parkTokens = new Set(parkNames.flatMap(strongTokens));
  const shared = disTokens.filter((t) => parkTokens.has(t)).length;
  return shared > 0 ? null : dis;
}
