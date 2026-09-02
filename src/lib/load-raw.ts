import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { wikidataRawRunDir } from "../lib/paths.js";
import type { WikidataEntityKind, WikidataRawRunMeta, WikidataSparqlPage } from "../sources/wikidata/types.js";

export async function latestRunIdIn(root: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  const runs = entries.filter(Boolean).sort();
  return runs.at(-1) ?? null;
}

export async function latestWikidataRawRunId(dataRoot = "data"): Promise<string | null> {
  return latestRunIdIn(join(dataRoot, "raw", "wikidata"));
}

export async function latestProcessedRunId(dataRoot = "data"): Promise<string | null> {
  return latestRunIdIn(join(dataRoot, "processed", "wikidata"));
}

async function loadEntityPages(
  runDir: string,
  entity: WikidataEntityKind,
): Promise<WikidataSparqlPage[]> {
  const pagesDir = join(runDir, entity, "pages");
  let pageFiles: string[];
  try {
    pageFiles = (await readdir(pagesDir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }

  const pages: WikidataSparqlPage[] = [];
  for (const fileName of pageFiles) {
    pages.push(JSON.parse(await readFile(join(pagesDir, fileName), "utf8")) as WikidataSparqlPage);
  }
  return pages;
}

export type LoadedRawRun = {
  runId: string;
  runDir: string;
  meta: WikidataRawRunMeta;
  coasterPages: WikidataSparqlPage[];
  parkPages: WikidataSparqlPage[];
};

export async function loadWikidataRawRun(
  runId: string,
  dataRoot = "data",
): Promise<LoadedRawRun> {
  const runDir = wikidataRawRunDir(runId, dataRoot);
  const meta = JSON.parse(
    await readFile(join(runDir, "meta.json"), "utf8"),
  ) as WikidataRawRunMeta;

  const [coasterPages, parkPages] = await Promise.all([
    loadEntityPages(runDir, "coasters"),
    loadEntityPages(runDir, "parks"),
  ]);

  return { runId, runDir, meta, coasterPages, parkPages };
}

export async function loadLatestWikidataRawRun(dataRoot = "data"): Promise<LoadedRawRun> {
  const runId = await latestWikidataRawRunId(dataRoot);
  if (!runId) {
    throw new Error("No raw Wikidata ingest found. Run npm run ingest first.");
  }
  return loadWikidataRawRun(runId, dataRoot);
}
