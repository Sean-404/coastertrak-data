/** Deterministic canonical IDs derived from source identifiers. */

export type SourceKind = "wikidata" | "rcdb" | "manual";

const PREFIX = {
  park: "park",
  coaster: "coaster",
} as const;

function normaliseSourceId(sourceId: string): string {
  const trimmed = sourceId.trim();
  const qid = trimmed.match(/^Q(\d+)$/i);
  if (qid) return `Q${qid[1]}`;
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function parkIdFromSource(source: SourceKind, sourceId: string): string {
  return `${PREFIX.park}_${source}_${normaliseSourceId(sourceId)}`;
}

export function coasterIdFromSource(source: SourceKind, sourceId: string): string {
  return `${PREFIX.coaster}_${source}_${normaliseSourceId(sourceId)}`;
}

export function parseWikidataQid(uriOrQid: string): string | null {
  const trimmed = uriOrQid.trim();
  const fromUri = trimmed.match(/\/(Q\d+)$/i);
  if (fromUri) return fromUri[1]!.toUpperCase().replace(/^q/, "Q");
  const direct = trimmed.match(/^(Q\d+)$/i);
  if (direct) return direct[1]!.toUpperCase().replace(/^q/, "Q");
  return null;
}
