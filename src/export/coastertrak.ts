/**
 * CoasterTrak export adapter (Phase 1 — types and mapping documentation only).
 *
 * Future import into CoasterTrak production DB reads data/output/ and maps
 * canonical entities to the existing Supabase schema. This module does NOT
 * connect to production.
 *
 * Mapping reference (canonical → CoasterTrak DB):
 *
 * | Canonical field              | CoasterTrak column        | Notes                          |
 * |-----------------------------|---------------------------|--------------------------------|
 * | parks.countryCode → lookup  | parks.country             | ISO → display label            |
 * | parks.name.value            | parks.name                |                                |
 * | parks.coordinates.value     | parks.latitude/longitude  |                                |
 * | parks.sourceIds.wikidata    | parks.external_id         | external_source = 'wikidata'   |
 * | coasters.sourceIds.wikidata | coasters.wikidata_id      | also external_id               |
 * | coasters.name.value         | coasters.name             |                                |
 * | coasters.parkId             | coasters.park_id          | resolved via stable ID map     |
 * | coasters.coasterType.value  | coasters.coaster_type     |                                |
 * | coasters.manufacturer.value | coasters.manufacturer     |                                |
 * | coasters.status (mapped)    | coasters.status           | see toCoasterTrakCoasterStatus |
 * | coasters.height (m → ft)    | coasters.height_ft        | Math.round(m * 3.28084)        |
 * | coasters.speed (m/s → mph)  | coasters.speed_mph        | Math.round(m/s * 2.23694)      |
 * | coasters.length (m → ft)    | coasters.length_ft        | Math.round(m * 3.28084)        |
 * | coasters.inversions.value   | coasters.inversions       |                                |
 * | coasters.duration.value     | coasters.duration_s       |                                |
 * | coasters.openingDate        | coasters.opening_year     | extract year                   |
 * | coasters.closingDate        | coasters.closing_year     | extract year                   |
 * | coasters.imageUrl.value     | coasters.image_url        |                                |
 * | coasters.description.value  | coasters.summary_text     |                                |
 * | coasters.sourceIds.enwiki   | coasters.enwiki_title     |                                |
 */

import type { CanonicalCoaster, CanonicalPark } from "../canonical/index.js";
import { countryDisplayName } from "../canonical/country.js";
import {
  toCoasterTrakCoasterStatus,
  toCoasterTrakParkStatus,
  type CoasterStatus,
} from "../canonical/status.js";
import type { Quantity } from "../canonical/provenance.js";

const METRES_TO_FEET = 3.28084;
const MS_TO_MPH = 2.23694;

/** CoasterTrak parks table shape (documentation / future import). */
export type CoasterTrakParkExport = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  external_source: "wikidata";
  external_id: string;
  /** Stable canonical ID for upsert matching — not stored in DB today. */
  canonical_id: string;
};

/** CoasterTrak coasters table shape (documentation / future import). */
export type CoasterTrakCoasterExport = {
  name: string;
  park_canonical_id: string | null;
  coaster_type: string;
  manufacturer: string | null;
  status: string;
  external_source: "wikidata";
  external_id: string;
  wikidata_id: string;
  canonical_id: string;
  height_ft: number | null;
  speed_mph: number | null;
  length_ft: number | null;
  inversions: number | null;
  duration_s: number | null;
  opening_year: number | null;
  closing_year: number | null;
  image_url: string | null;
  enwiki_title: string | null;
  summary_text: string | null;
};

export type CoasterTrakCatalogExport = {
  version: 1;
  generatedAt: string;
  parks: CoasterTrakParkExport[];
  coasters: CoasterTrakCoasterExport[];
};

function metresToFeet(m: number): number {
  return Math.round(m * METRES_TO_FEET);
}

function msToMph(ms: number): number {
  return Math.round(ms * MS_TO_MPH);
}

function quantityMetres(q: Quantity | undefined | null): number | null {
  if (!q || q.unit !== "m") return null;
  return metresToFeet(q.value);
}

function quantityMs(q: Quantity | undefined | null): number | null {
  if (!q || q.unit !== "m/s") return null;
  return msToMph(q.value);
}

function yearFromDate(date: string | undefined | null): number | null {
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/** Map a canonical park to CoasterTrak export shape. Phase 2: called by export CLI. */
export function mapParkToCoasterTrakExport(park: CanonicalPark): CoasterTrakParkExport {
  const coords = park.coordinates?.value;
  if (!coords) {
    throw new Error(`Park ${park.id} missing coordinates required for CoasterTrak export`);
  }
  const wikidataId = park.sourceIds.wikidata;
  if (!wikidataId) {
    throw new Error(`Park ${park.id} missing wikidata source ID`);
  }

  return {
    name: park.name.value,
    country: countryDisplayName(park.countryCode.value),
    latitude: coords.lat,
    longitude: coords.lng,
    external_source: "wikidata",
    external_id: wikidataId,
    canonical_id: park.id,
  };
}

/** Map a canonical coaster to CoasterTrak export shape. Phase 2: called by export CLI. */
export function mapCoasterToCoasterTrakExport(coaster: CanonicalCoaster): CoasterTrakCoasterExport {
  const wikidataId = coaster.sourceIds.wikidata;
  if (!wikidataId) {
    throw new Error(`Coaster ${coaster.id} missing wikidata source ID`);
  }

  return {
    name: coaster.name.value,
    park_canonical_id: coaster.parkId,
    coaster_type: coaster.coasterType?.value ?? "Unknown",
    manufacturer: coaster.manufacturer?.value ?? null,
    status: toCoasterTrakCoasterStatus(coaster.status as CoasterStatus),
    external_source: "wikidata",
    external_id: wikidataId,
    wikidata_id: wikidataId,
    canonical_id: coaster.id,
    height_ft: coaster.height ? quantityMetres(coaster.height.value) : null,
    speed_mph: coaster.speed ? quantityMs(coaster.speed.value) : null,
    length_ft: coaster.length ? quantityMetres(coaster.length.value) : null,
    inversions: coaster.inversions?.value ?? null,
    duration_s: coaster.duration?.value ?? null,
    opening_year: yearFromDate(coaster.openingDate?.value),
    closing_year: yearFromDate(coaster.closingDate?.value),
    image_url: coaster.imageUrl?.value ?? null,
    enwiki_title: coaster.sourceIds.enwiki ?? null,
    summary_text: coaster.description?.value ?? null,
  };
}

/** Re-export status mappers for documentation consumers. */
export { toCoasterTrakCoasterStatus, toCoasterTrakParkStatus };
