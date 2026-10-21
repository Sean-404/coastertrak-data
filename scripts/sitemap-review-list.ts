/**
 * Checklist of catalog rows to verify at the parks CoasterTrak offers to search engines.
 *
 *   npx tsx scripts/sitemap-review-list.ts <processed-run-dir> <sitemap.xml> <out.md>
 *
 * Fetch the sitemap first (curl -o sitemap.xml https://coastertrak.com/sitemap.xml).
 * Flags rows with no confirmed status and former installations shown as non-defunct.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import type { CanonicalCoaster } from "../src/canonical/coaster.js";
import type { CanonicalPark } from "../src/canonical/park.js";
import { validateCatalog } from "../src/validate/rules.js";

const [dir, sitemapPath, out] = process.argv.slice(2);
if (!dir || !sitemapPath || !out) {
  console.error("Usage: tsx scripts/sitemap-review-list.ts <processed-run-dir> <sitemap.xml> <out.md>");
  process.exit(1);
}

function readEntities<T>(file: string, key: string): T[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as T[] | Record<string, T[]>;
  return Array.isArray(raw) ? raw : (raw[key] ?? []);
}

const coasters = readEntities<CanonicalCoaster>(`${dir}/coasters.json`, "coasters");
const parks = readEntities<CanonicalPark>(`${dir}/parks.json`, "parks");

/** Same shape as CoasterTrak park slugs (name part only; the numeric id is DB-only). */
const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const sitemapParkSlugs = new Set(
  [...readFileSync(sitemapPath, "utf8").matchAll(/\/parks\/([^<]*)-\d+<\/loc>/g)].map((m) => m[1]),
);

const { report } = validateCatalog({ parks, coasters, sourceRunId: basename(dir) });

const notesByCoaster = new Map<string, string[]>();
for (const finding of report.findings) {
  if (finding.entityType !== "coaster" || !finding.entityId) continue;
  const details = finding.details ?? {};
  let note: string | null = null;
  if (finding.code === "name_names_other_park" && finding.severity === "warning") {
    note = `label names "${String(details.disambiguator)}" but shown as ${String(details.status).toLowerCase()} here`;
  }
  if (
    finding.code === "missing_coaster_fields" &&
    Array.isArray(details.fields) &&
    details.fields.includes("status")
  ) {
    note = "status not confirmed";
  }
  if (note) notesByCoaster.set(finding.entityId, [...(notesByCoaster.get(finding.entityId) ?? []), note]);
}

const sitemapParks = parks.filter((park) => sitemapParkSlugs.has(slug(park.name.value)));
const rows = sitemapParks
  .map((park) => ({
    park,
    flagged: coasters.filter((c) => c.parkId === park.id && notesByCoaster.has(c.id)),
  }))
  .filter((row) => row.flagged.length > 0)
  .sort(
    (a, b) => b.flagged.length - a.flagged.length || a.park.name.value.localeCompare(b.park.name.value),
  );

const rideCount = rows.reduce((n, row) => n + row.flagged.length, 0);
const lines: string[] = [
  "# Catalog review list — parks in the public sitemap",
  "",
  `Generated ${new Date().toISOString().slice(0, 10)} from snapshot \`${basename(dir)}\` and the live sitemap (${sitemapParkSlugs.size} parks, ${sitemapParks.length} matched).`,
  "",
  `**${rideCount} rides across ${rows.length} sitemap parks need a check.**`,
  "",
  "For each flagged ride: confirm against the park's own website (or a news source) and record the fix with its source URL in `data_coaster_field_overrides`. Do not fill gaps from memory.",
  "",
];
for (const { park, flagged } of rows) {
  lines.push(`## ${park.name.value} (${flagged.length})`, "");
  for (const coaster of flagged) {
    const dbId = coaster.sourceIds.coastertrak ? ` — db id ${coaster.sourceIds.coastertrak}` : "";
    lines.push(`- [ ] **${coaster.name.value}**${dbId}: ${notesByCoaster.get(coaster.id)!.join("; ")}`);
  }
  lines.push("");
}

writeFileSync(out, lines.join("\n"));
console.log(`Matched ${sitemapParks.length} sitemap parks; flagged ${rideCount} rides at ${rows.length} parks → ${out}`);
