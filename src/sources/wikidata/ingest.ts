import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { formatPageFileName, newRunId, wikidataFixturePagesDir, wikidataRawRunDir } from "../../lib/paths.js";
import { logger } from "../../lib/logger.js";
import type { IngestOptions, RawIngestMeta, RawIngestResult, SourceAdapter } from "../types.js";
import { fetchAllRawPages, countUniqueItems } from "./client.js";
import type { WikidataEntityKind, WikidataRawRunMeta, WikidataSparqlPage } from "./types.js";

async function copyFixturePages(
  entity: WikidataEntityKind,
  pagesDir: string,
): Promise<{ pages: WikidataSparqlPage[]; pageCount: number; totalBindings: number }> {
  const fixtureDir = wikidataFixturePagesDir(entity);
  await mkdir(pagesDir, { recursive: true });

  let entries: string[];
  try {
    entries = (await readdir(fixtureDir)).filter((f: string) => f.endsWith(".json")).sort();
  } catch {
    logger.warn(`No fixture pages found for ${entity}`, { fixtureDir });
    return { pages: [], pageCount: 0, totalBindings: 0 };
  }

  const pages: WikidataSparqlPage[] = [];
  for (const fileName of entries) {
    const src = join(fixtureDir, fileName);
    const dest = join(pagesDir, fileName);
    await cp(src, dest);
    const raw = JSON.parse(await readFile(src, "utf8")) as WikidataSparqlPage;
    pages.push(raw);
  }

  const totalBindings = pages.reduce((sum, p) => sum + p.bindingCount, 0);
  return { pages, pageCount: pages.length, totalBindings };
}

async function ingestEntityLive(
  entity: WikidataEntityKind,
  runDir: string,
  options: IngestOptions,
): Promise<{ queryMode: string; pageCount: number; totalBindings: number; uniqueItemCount: number }> {
  const pagesDir = join(runDir, entity, "pages");
  await mkdir(pagesDir, { recursive: true });

  const log = options.onProgress ?? ((msg: string) => logger.info(msg));
  let currentMode = "full";

  const summary = await fetchAllRawPages({
    entity,
    maxRows: options.maxRows,
    pageSize: options.pageSize ?? 200,
    delayMs: options.delayMs ?? 2000,
    allowLiteFallback: true,
    onPaginationRestart: async () => {
      log(`  ${entity}: query fallback restarted pagination; clearing prior page files`);
      await rm(pagesDir, { recursive: true, force: true });
      await mkdir(pagesDir, { recursive: true });
    },
    onPage: async (page) => {
      currentMode = page.queryMode;
      const fileName = formatPageFileName(page.offset);
      await writeFile(join(pagesDir, fileName), JSON.stringify(page, null, 2), "utf8");
      log(`  ${entity} page offset ${page.offset} (${page.bindingCount} bindings, ${page.queryMode})`);
    },
  });

  return {
    queryMode: summary.queryMode ?? currentMode,
    pageCount: summary.pages.length,
    totalBindings: summary.totalBindings,
    uniqueItemCount: countUniqueItems(summary.pages),
  };
}

async function ingestEntityFixture(
  entity: WikidataEntityKind,
  runDir: string,
): Promise<{ queryMode: string; pageCount: number; totalBindings: number; uniqueItemCount: number }> {
  const pagesDir = join(runDir, entity, "pages");
  const { pages, pageCount, totalBindings } = await copyFixturePages(entity, pagesDir);
  const queryMode = pages[0]?.queryMode ?? "full";
  return {
    queryMode,
    pageCount,
    totalBindings,
    uniqueItemCount: countUniqueItems(pages),
  };
}

export class WikidataSourceAdapter implements SourceAdapter {
  readonly sourceId = "wikidata";

  async ingest(options: IngestOptions = {}): Promise<RawIngestResult> {
    const runId = options.runId ?? newRunId();
    const runDir = wikidataRawRunDir(runId, options.dataRoot);
    const entities = options.entities ?? (["coasters", "parks"] as WikidataEntityKind[]);
    const useFixture = options.fixture ?? true;

    if (options.dryRun) {
      logger.info("Dry run: would ingest Wikidata", { runId, entities, useFixture });
      return {
        runDir,
        meta: {
          generatedAt: new Date().toISOString(),
          source: "wikidata",
          runId,
          endpoint: "https://query.wikidata.org/sparql",
          mode: useFixture ? "fixture" : "live",
          entities,
          pageCount: 0,
          totalBindings: 0,
          options: { dryRun: true },
        },
      };
    }

    await mkdir(runDir, { recursive: true });
    const log = options.onProgress ?? ((msg: string) => logger.info(msg));
    log(`Ingesting Wikidata (${useFixture ? "fixture" : "live"}) → ${runDir}`);

    const meta: WikidataRawRunMeta = {
      generatedAt: new Date().toISOString(),
      source: "wikidata",
      runId,
      endpoint: "https://query.wikidata.org/sparql",
      mode: useFixture ? "fixture" : "live",
      options: {
        maxRows: options.maxRows ?? null,
        pageSize: options.pageSize ?? 200,
        delayMs: options.delayMs ?? 2000,
        entities,
      },
    };

    let totalPageCount = 0;
    let totalBindings = 0;

    for (const entity of entities) {
      const stats = useFixture
        ? await ingestEntityFixture(entity, runDir)
        : await ingestEntityLive(entity, runDir, options);

      meta[entity] = {
        queryMode: stats.queryMode as "full" | "core" | "lite",
        pageCount: stats.pageCount,
        totalBindings: stats.totalBindings,
        uniqueItemCount: stats.uniqueItemCount,
      };
      totalPageCount += stats.pageCount;
      totalBindings += stats.totalBindings;
    }

    await writeFile(join(runDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
    log(`Done: ${totalPageCount} pages, ${totalBindings} bindings`);

    const resultMeta: RawIngestMeta = {
      generatedAt: meta.generatedAt,
      source: meta.source,
      runId: meta.runId,
      endpoint: meta.endpoint,
      mode: meta.mode,
      entities,
      pageCount: totalPageCount,
      totalBindings,
      options: meta.options,
    };

    return { runDir, meta: resultMeta };
  }
}

export const wikidataAdapter = new WikidataSourceAdapter();

export async function ingestWikidata(options?: IngestOptions): Promise<RawIngestResult> {
  return wikidataAdapter.ingest(options);
}
