import type { CanonicalCoaster } from "../../canonical/coaster.js";
import type { CanonicalPark } from "../../canonical/park.js";
import { normaliseCountryToIso } from "../../canonical/country.js";
import type { CoasterStatus } from "../../canonical/status.js";
import { coasterIdFromSource, parkIdFromSource } from "../../lib/ids.js";
import { fetchAllPages, SUPABASE_PAGE_SIZE } from "../../lib/supabase-fetch-all.js";
import { createSupabaseClient } from "../../lib/supabase.js";
import type { SupabaseCoasterRow, SupabaseParkRow } from "./types.js";

const FT_TO_M = 0.3048;
const MPH_TO_MS = 1 / 2.23694;

function dbProvenance(sourceId: string, retrievedAt: string, rawValue?: unknown) {
  return [{ source: "coastertrak_db", sourceId, retrievedAt, rawValue }];
}

function parkCanonicalId(row: SupabaseParkRow): string {
  const qid = row.external_id?.match(/^Q\d+$/i)?.[0];
  if (qid && row.external_source?.includes("wikidata")) {
    return parkIdFromSource("wikidata", qid);
  }
  return `park_db_${row.id}`;
}

function coasterCanonicalId(row: SupabaseCoasterRow): string {
  const qid = (row.wikidata_id ?? row.external_id)?.match(/^Q\d+$/i)?.[0];
  if (qid) return coasterIdFromSource("wikidata", qid);
  return `coaster_db_${row.id}`;
}

function mapDbCoasterStatus(status: string, closingYear: number | null): CoasterStatus {
  const s = status.trim().toLowerCase();
  if (s === "defunct" || closingYear != null) return closingYear != null ? "REMOVED" : "CLOSED";
  if (s === "operating" || s === "open") return "OPERATING";
  return "UNKNOWN";
}

export function mapSupabasePark(row: SupabaseParkRow, retrievedAt: string): CanonicalPark | null {
  const countryCode = normaliseCountryToIso(row.country);
  if (!countryCode) return null;

  const sourceIds: CanonicalPark["sourceIds"] = {};
  const qid = row.external_id?.match(/^Q\d+$/i)?.[0];
  if (qid) sourceIds.wikidata = qid.toUpperCase();

  return {
    id: parkCanonicalId(row),
    sourceIds,
    name: {
      value: row.name,
      provenance: dbProvenance(String(row.id), retrievedAt, row.name),
    },
    aliases: [],
    countryCode: {
      value: countryCode,
      provenance: dbProvenance(String(row.id), retrievedAt, row.country),
    },
    status: "OPERATING",
    coordinates: {
      value: { lat: row.latitude, lng: row.longitude },
      provenance: dbProvenance(String(row.id), retrievedAt),
    },
    website: null,
    verification: { needsReview: false, reviewReasons: [] },
  };
}

export function mapSupabaseCoaster(
  row: SupabaseCoasterRow,
  parkIdByDbId: Map<number, string>,
  retrievedAt: string,
): CanonicalCoaster {
  const sourceIds: CanonicalCoaster["sourceIds"] = {};
  const qid = (row.wikidata_id ?? row.external_id)?.match(/^Q\d+$/i)?.[0];
  if (qid) sourceIds.wikidata = qid.toUpperCase();
  if (row.enwiki_title) sourceIds.enwiki = row.enwiki_title;
  sourceIds.coastertrak = String(row.id);

  const provId = String(row.id);
  const parkId = parkIdByDbId.get(row.park_id) ?? null;
  const countryCode = null;

  return {
    id: coasterCanonicalId(row),
    sourceIds,
    name: {
      value: row.name,
      provenance: dbProvenance(provId, retrievedAt, row.name),
    },
    aliases: [],
    parkId,
    countryCode: countryCode,
    manufacturer: row.manufacturer
      ? { value: row.manufacturer, provenance: dbProvenance(provId, retrievedAt) }
      : null,
    model: null,
    coasterType: row.coaster_type
      ? { value: row.coaster_type, provenance: dbProvenance(provId, retrievedAt) }
      : null,
    status: mapDbCoasterStatus(row.status, row.closing_year),
    openingDate: row.opening_year
      ? { value: String(row.opening_year), provenance: dbProvenance(provId, retrievedAt) }
      : null,
    closingDate: row.closing_year
      ? { value: String(row.closing_year), provenance: dbProvenance(provId, retrievedAt) }
      : null,
    height:
      row.height_ft != null
        ? {
            value: { value: Math.round(row.height_ft * FT_TO_M * 10) / 10, unit: "m" },
            provenance: dbProvenance(provId, retrievedAt, row.height_ft),
          }
        : null,
    speed:
      row.speed_mph != null
        ? {
            value: { value: Math.round(row.speed_mph * MPH_TO_MS * 100) / 100, unit: "m/s" },
            provenance: dbProvenance(provId, retrievedAt, row.speed_mph),
          }
        : null,
    length:
      row.length_ft != null
        ? {
            value: { value: Math.round(row.length_ft * FT_TO_M), unit: "m" },
            provenance: dbProvenance(provId, retrievedAt, row.length_ft),
          }
        : null,
    inversions:
      row.inversions != null
        ? { value: row.inversions, provenance: dbProvenance(provId, retrievedAt) }
        : null,
    duration:
      row.duration_s != null
        ? { value: row.duration_s, provenance: dbProvenance(provId, retrievedAt) }
        : null,
    coordinates: null,
    description: row.summary_text
      ? { value: row.summary_text, provenance: dbProvenance(provId, retrievedAt) }
      : null,
    imageUrl: row.image_url
      ? { value: row.image_url, provenance: dbProvenance(provId, retrievedAt) }
      : null,
    verification: { needsReview: false, reviewReasons: [] },
  };
}

export type SupabaseCatalogExport = {
  parks: CanonicalPark[];
  coasters: CanonicalCoaster[];
  skippedParks: number;
};

export async function exportCatalogFromSupabase(): Promise<SupabaseCatalogExport> {
  const client = createSupabaseClient();
  const retrievedAt = new Date().toISOString();

  const parksResult = await fetchAllPages<SupabaseParkRow>(SUPABASE_PAGE_SIZE, (from, to) =>
    client
      .from("parks")
      .select(
        "id,name,country,latitude,longitude,external_source,external_id,last_synced_at",
      )
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (parksResult.error) throw new Error(`Failed to fetch parks: ${parksResult.error.message}`);

  const coastersResult = await fetchAllPages<SupabaseCoasterRow>(
    SUPABASE_PAGE_SIZE,
    (from, to) =>
      client
        .from("coasters")
        .select(
          "id,park_id,name,coaster_type,manufacturer,status,external_source,external_id,wikidata_id,height_ft,speed_mph,length_ft,inversions,duration_s,opening_year,closing_year,enwiki_title,summary_text,image_url,last_synced_at",
        )
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (coastersResult.error) {
    throw new Error(`Failed to fetch coasters: ${coastersResult.error.message}`);
  }

  const parks: CanonicalPark[] = [];
  let skippedParks = 0;
  const parkIdByDbId = new Map<number, string>();

  for (const row of parksResult.data) {
    const mapped = mapSupabasePark(row, retrievedAt);
    if (!mapped) {
      skippedParks++;
      continue;
    }
    parks.push(mapped);
    parkIdByDbId.set(row.id, mapped.id);
  }

  const parksById = new Map(parks.map((p) => [p.id, p]));
  const coasters = coastersResult.data.map((row) => {
    const coaster = mapSupabaseCoaster(row, parkIdByDbId, retrievedAt);
    const parkId = parkIdByDbId.get(row.park_id);
    if (parkId) {
      const park = parksById.get(parkId);
      if (park) {
        coaster.countryCode = {
          value: park.countryCode.value,
          provenance: [
            {
              source: "derived",
              sourceId: parkId,
              retrievedAt,
            },
          ],
        };
      }
    }
    return coaster;
  });

  return { parks, coasters, skippedParks };
}
