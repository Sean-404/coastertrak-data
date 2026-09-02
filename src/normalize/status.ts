import type { CoasterStatus } from "../canonical/status.js";
import { parseWikidataDate } from "./dates.js";

export type WikidataLifecycleInput = {
  opening?: string | null;
  retirement?: string | null;
  demolished?: string | null;
};

/** Map Wikidata lifecycle dates to canonical coaster status. */
export function inferCoasterStatus(input: WikidataLifecycleInput): CoasterStatus {
  const opening = parseWikidataDate(input.opening ?? undefined);
  const retirement = parseWikidataDate(input.retirement ?? undefined);
  const demolished = parseWikidataDate(input.demolished ?? undefined);
  const now = new Date();

  const endRaw = demolished ?? retirement ?? null;
  const end = endRaw ? new Date(endRaw.length === 4 ? `${endRaw}-12-31` : endRaw) : null;
  const openingDate = opening
    ? new Date(opening.length === 4 ? `${opening}-01-01` : opening)
    : null;

  const hasValidEnd = !!end && !Number.isNaN(end.getTime());
  const hasValidOpening = !!openingDate && !Number.isNaN(openingDate.getTime());

  if (hasValidEnd && hasValidOpening && openingDate!.getTime() > end!.getTime()) {
    if (openingDate! > now) return "UNDER_CONSTRUCTION";
    return "OPERATING";
  }

  if (hasValidEnd && end! < now) {
    return demolished ? "REMOVED" : "CLOSED";
  }

  if (hasValidOpening) {
    if (openingDate! > now) return "UNDER_CONSTRUCTION";
    return "OPERATING";
  }

  if (demolished || retirement) return "REMOVED";
  return "UNKNOWN";
}
