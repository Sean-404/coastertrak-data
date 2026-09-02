/** Normalise names for display and matching. Does not merge entities. */

export function normalizeDisplayName(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase, strip accents and punctuation for similarity matching. */
export function normalizeNameForMatch(name: string): string {
  return normalizeDisplayName(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/\b(theme|amusement|family|water)\s+park\b/gi, "")
    .replace(/\bresort\b/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlaceholderName(name: string | null | undefined): boolean {
  const n = normalizeDisplayName(name).toLowerCase();
  return n === "" || n === "unknown" || n === "other" || n === "n/a" || n === "na";
}

export function isWikidataQidLabel(value: string | null | undefined): boolean {
  return /^Q\d+$/i.test((value ?? "").trim());
}

export function humanWikidataLabel(value: string | null | undefined): string | null {
  const trimmed = normalizeDisplayName(value);
  if (!trimmed || isWikidataQidLabel(trimmed)) return null;
  return trimmed;
}
