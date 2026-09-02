import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { CanonicalCoaster } from "../canonical/coaster.js";
import type { CanonicalPark } from "../canonical/park.js";
import type { Confidence, ProvenanceRecord, SourcedValue } from "../canonical/provenance.js";
import { overridesDir } from "../lib/paths.js";
import {
  coasterOverridesFileSchema,
  parkOverridesFileSchema,
  type CoasterOverrideEntry,
  type ParkOverrideEntry,
} from "./types.js";

export type LoadedOverrides = {
  parks: ParkOverrideEntry[];
  coasters: CoasterOverrideEntry[];
};

async function readOverridesFile<T>(
  path: string,
  parser: (raw: unknown) => T,
): Promise<T | null> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    return parser(raw);
  } catch {
    return null;
  }
}

export async function loadOverrides(dataRoot = "data"): Promise<LoadedOverrides> {
  const root = overridesDir(dataRoot);
  const parksFile =
    (await readOverridesFile(join(root, "parks.json"), (r) =>
      parkOverridesFileSchema.parse(r),
    )) ??
    (await readOverridesFile(join(root, "parks.example.json"), (r) =>
      parkOverridesFileSchema.parse(r),
    ));

  const coastersFile =
    (await readOverridesFile(join(root, "coasters.json"), (r) =>
      coasterOverridesFileSchema.parse(r),
    )) ??
    (await readOverridesFile(join(root, "coasters.example.json"), (r) =>
      coasterOverridesFileSchema.parse(r),
    ));

  return {
    parks: parksFile?.overrides ?? [],
    coasters: coastersFile?.overrides ?? [],
  };
}

function matchesEntity(
  entity: { id: string; sourceIds: { wikidata?: string } },
  match: ParkOverrideEntry["match"],
): boolean {
  if (match.id && match.id === entity.id) return true;
  const qid = match["sourceIds.wikidata"];
  if (qid && entity.sourceIds.wikidata?.toUpperCase() === qid.toUpperCase()) return true;
  return false;
}

function manualProvenance(
  sourceId: string | undefined,
  override: ParkOverrideEntry | CoasterOverrideEntry,
): ProvenanceRecord {
  return {
    source: "manual",
    sourceId,
    retrievedAt: override.appliedAt,
    rawValue: override.reason,
  };
}

function patchSourced<T>(
  current: SourcedValue<T>,
  value: T,
  prov: ProvenanceRecord,
): SourcedValue<T> {
  return {
    value,
    provenance: [...current.provenance, prov],
    confidence: "HIGH" as Confidence,
  };
}

export function applyParkOverrides(
  parks: CanonicalPark[],
  overrides: ParkOverrideEntry[],
): CanonicalPark[] {
  return parks.map((park) => {
    const override = overrides.find((o) => matchesEntity(park, o.match));
    if (!override) return park;

    const prov = manualProvenance(park.sourceIds.wikidata, override);
    const updated: CanonicalPark = { ...park };

    if (override.patch.name) {
      updated.name = patchSourced(park.name, override.patch.name, prov);
    }
    if (override.patch.countryCode) {
      updated.countryCode = patchSourced(park.countryCode, override.patch.countryCode, prov);
    }
    if (override.patch.status) {
      updated.status = override.patch.status as CanonicalPark["status"];
    }
    if (override.patch.aliases) {
      updated.aliases = [...new Set([...park.aliases, ...override.patch.aliases])];
    }

    return updated;
  });
}

export function applyCoasterOverrides(
  coasters: CanonicalCoaster[],
  overrides: CoasterOverrideEntry[],
): CanonicalCoaster[] {
  return coasters.map((coaster) => {
    const override = overrides.find((o) => matchesEntity(coaster, o.match));
    if (!override) return coaster;

    const prov = manualProvenance(coaster.sourceIds.wikidata, override);
    const updated: CanonicalCoaster = { ...coaster };

    if (override.patch.name) {
      updated.name = patchSourced(coaster.name, override.patch.name, prov);
    }
    if (override.patch.countryCode) {
      updated.countryCode = coaster.countryCode
        ? patchSourced(coaster.countryCode, override.patch.countryCode, prov)
        : {
            value: override.patch.countryCode,
            provenance: [prov],
            confidence: "HIGH",
          };
    }
    if (override.patch.parkId !== undefined) updated.parkId = override.patch.parkId;
    if (override.patch.status) {
      updated.status = override.patch.status as CanonicalCoaster["status"];
    }
    if (override.patch.manufacturer) {
      updated.manufacturer = coaster.manufacturer
        ? patchSourced(coaster.manufacturer, override.patch.manufacturer, prov)
        : { value: override.patch.manufacturer, provenance: [prov], confidence: "HIGH" };
    }
    if (override.patch.height != null) {
      updated.height = {
        value: { value: override.patch.height, unit: "m" },
        provenance: [...(coaster.height?.provenance ?? []), prov],
        confidence: "HIGH",
      };
    }
    if (override.patch.speed != null) {
      updated.speed = {
        value: { value: override.patch.speed, unit: "m/s" },
        provenance: [...(coaster.speed?.provenance ?? []), prov],
        confidence: "HIGH",
      };
    }
    if (override.patch.length != null) {
      updated.length = {
        value: { value: override.patch.length, unit: "m" },
        provenance: [...(coaster.length?.provenance ?? []), prov],
        confidence: "HIGH",
      };
    }
    if (override.patch.inversions != null) {
      updated.inversions = {
        value: override.patch.inversions,
        provenance: [...(coaster.inversions?.provenance ?? []), prov],
        confidence: "HIGH",
      };
    }

    return updated;
  });
}
