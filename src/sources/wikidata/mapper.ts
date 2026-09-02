import type { CanonicalCoaster } from "../../canonical/coaster.js";
import type { CanonicalPark } from "../../canonical/park.js";
import type { Confidence, ProvenanceRecord, SourcedValue } from "../../canonical/provenance.js";
import { normaliseCountryToIso } from "../../canonical/country.js";
import { coasterIdFromSource, parkIdFromSource } from "../../lib/ids.js";
import { inferCoasterType } from "../../normalize/coaster-type.js";
import { parseWktPoint } from "../../normalize/coordinates.js";
import { parseWikidataDate } from "../../normalize/dates.js";
import { humanWikidataLabel } from "../../normalize/name.js";
import { inferCoasterStatus } from "../../normalize/status.js";
import {
  bindingLiteral,
  bindingNumber,
  bindingQid,
  collectBindingsByItem,
  mergeBindings,
  wikimediaImageUrl,
} from "./bindings.js";
import type { WikidataRawRunMeta, WikidataSparqlBinding, WikidataSparqlPage } from "./types.js";

export type MapRawInput = {
  meta: WikidataRawRunMeta;
  coasterPages: WikidataSparqlPage[];
  parkPages: WikidataSparqlPage[];
};

export type MapRawResult = {
  parks: CanonicalPark[];
  coasters: CanonicalCoaster[];
  warnings: string[];
};

function provenance(
  sourceId: string,
  retrievedAt: string,
  rawValue?: unknown,
): ProvenanceRecord[] {
  return [{ source: "wikidata", sourceId, retrievedAt, rawValue }];
}

function sourced<T>(
  value: T,
  sourceId: string,
  retrievedAt: string,
  opts?: { rawValue?: unknown; confidence?: Confidence },
): SourcedValue<T> {
  return {
    value,
    provenance: provenance(sourceId, retrievedAt, opts?.rawValue),
    confidence: opts?.confidence,
  };
}

function emptyVerification() {
  return { needsReview: false, reviewReasons: [] as string[] };
}

function mapParkBinding(
  binding: WikidataSparqlBinding,
  retrievedAt: string,
): CanonicalPark | null {
  const qid = bindingQid(binding.item);
  if (!qid) return null;

  const label = humanWikidataLabel(bindingLiteral(binding.itemLabel));
  if (!label) return null;

  const countryRaw = bindingLiteral(binding.countryLabel);
  const countryCode = normaliseCountryToIso(countryRaw);
  if (!countryCode) return null;

  const coords = parseWktPoint(bindingLiteral(binding.coord));
  const website = bindingLiteral(binding.website);

  return {
    id: parkIdFromSource("wikidata", qid),
    sourceIds: { wikidata: qid },
    name: sourced(label, qid, retrievedAt, { rawValue: bindingLiteral(binding.itemLabel) }),
    aliases: [],
    countryCode: sourced(countryCode, qid, retrievedAt, { rawValue: countryRaw }),
    status: "OPERATING",
    coordinates: coords ? sourced(coords, qid, retrievedAt) : null,
    website: website ? sourced(website, qid, retrievedAt) : null,
    verification: emptyVerification(),
  };
}

function mapCoasterBinding(
  binding: WikidataSparqlBinding,
  retrievedAt: string,
  parkIdsByWikidata: Map<string, string>,
): CanonicalCoaster | null {
  const qid = bindingQid(binding.item);
  if (!qid) return null;

  const label = humanWikidataLabel(bindingLiteral(binding.itemLabel));
  if (!label) return null;

  const parkQid =
    bindingQid(binding.parkParent) ?? bindingQid(binding.park) ?? null;
  const parkId = parkQid ? (parkIdsByWikidata.get(parkQid) ?? null) : null;

  const countryRaw = bindingLiteral(binding.countryLabel);
  const countryCode = normaliseCountryToIso(countryRaw);
  const coords = parseWktPoint(bindingLiteral(binding.coord));
  const manufacturer = humanWikidataLabel(bindingLiteral(binding.manufacturerLabel));
  const coasterType = inferCoasterType(bindingLiteral(binding.clsLabel));
  const opening = parseWikidataDate(bindingLiteral(binding.opening));
  const closing =
    parseWikidataDate(bindingLiteral(binding.demolished)) ??
    parseWikidataDate(bindingLiteral(binding.retirement));
  const status = inferCoasterStatus({
    opening: bindingLiteral(binding.opening),
    retirement: bindingLiteral(binding.retirement),
    demolished: bindingLiteral(binding.demolished),
  });

  const heightM = bindingNumber(binding.heightM);
  const speedMs = bindingNumber(binding.speedMs);
  const lengthM = bindingNumber(binding.lengthM);
  const durationS = bindingNumber(binding.durationS);
  const rcdbId = bindingLiteral(binding.rcdbId);
  const enwiki = bindingLiteral(binding.enwiki);
  const imageUrl = wikimediaImageUrl(binding.image);

  const sourceIds: CanonicalCoaster["sourceIds"] = { wikidata: qid };
  if (rcdbId) sourceIds.rcdb = rcdbId;
  if (enwiki) sourceIds.enwiki = enwiki;

  return {
    id: coasterIdFromSource("wikidata", qid),
    sourceIds,
    name: sourced(label, qid, retrievedAt, { rawValue: bindingLiteral(binding.itemLabel) }),
    aliases: [],
    parkId,
    countryCode: countryCode
      ? sourced(countryCode, qid, retrievedAt, { rawValue: countryRaw })
      : null,
    manufacturer: manufacturer ? sourced(manufacturer, qid, retrievedAt) : null,
    model: null,
    coasterType: coasterType ? sourced(coasterType, qid, retrievedAt, { rawValue: bindingLiteral(binding.clsLabel) }) : null,
    status,
    openingDate: opening ? sourced(opening, qid, retrievedAt, { rawValue: bindingLiteral(binding.opening) }) : null,
    closingDate: closing ? sourced(closing, qid, retrievedAt) : null,
    height: heightM != null ? sourced({ value: heightM, unit: "m" as const }, qid, retrievedAt) : null,
    speed: speedMs != null ? sourced({ value: speedMs, unit: "m/s" as const }, qid, retrievedAt) : null,
    length: lengthM != null ? sourced({ value: lengthM, unit: "m" as const }, qid, retrievedAt) : null,
    inversions: null,
    duration: durationS != null ? sourced(durationS, qid, retrievedAt) : null,
    coordinates: coords ? sourced(coords, qid, retrievedAt) : null,
    description: null,
    imageUrl: imageUrl ? sourced(imageUrl, qid, retrievedAt) : null,
    verification: emptyVerification(),
  };
}

function collectAllBindings(pages: WikidataSparqlPage[]): WikidataSparqlBinding[] {
  return pages.flatMap((page) => page.bindings);
}

export function mapWikidataRaw(input: MapRawInput): MapRawResult {
  const retrievedAt = input.meta.generatedAt;
  const warnings: string[] = [];
  const parkBindings = collectAllBindings(input.parkPages);
  const coasterBindings = collectAllBindings(input.coasterPages);

  const parks: CanonicalPark[] = [];
  for (const [, bindings] of collectBindingsByItem(parkBindings)) {
    const park = mapParkBinding(mergeBindings(bindings), retrievedAt);
    if (park) parks.push(park);
  }

  const parkIdsByWikidata = new Map(
    parks.map((p) => [p.sourceIds.wikidata!, p.id] as const).filter(([qid]) => !!qid),
  );

  const coasters: CanonicalCoaster[] = [];
  for (const [, bindings] of collectBindingsByItem(coasterBindings)) {
    const coaster = mapCoasterBinding(mergeBindings(bindings), retrievedAt, parkIdsByWikidata);
    if (coaster) {
      if (!coaster.parkId) {
        warnings.push(`Coaster ${coaster.id} missing park linkage`);
      }
      coasters.push(coaster);
    }
  }

  return { parks, coasters, warnings };
}
