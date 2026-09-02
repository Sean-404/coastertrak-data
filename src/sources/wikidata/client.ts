import { parseWikidataQid } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import { sleep, withRetry } from "../../lib/retry.js";
import {
  WIKIDATA_SPARQL_ENDPOINT,
  buildPaginatedQuery,
  getQueriesForEntity,
} from "./queries.js";
import type {
  FetchPageResult,
  PaginatedFetchOptions,
  PaginatedFetchSummary,
  WikidataQueryMode,
  WikidataSparqlBinding,
  WikidataSparqlPage,
} from "./types.js";

export const DEFAULT_WIKIDATA_USER_AGENT =
  "coastertrak-data/0.1 (data pipeline; https://github.com/coastertrak/coastertrak-data)";

export function getWikidataUserAgent(): string {
  return process.env.WIKIDATA_USER_AGENT ?? DEFAULT_WIKIDATA_USER_AGENT;
}

type SparqlResponse = {
  results?: {
    bindings?: WikidataSparqlBinding[];
  };
};

export async function fetchSparqlPage(
  query: string,
  options?: {
    userAgent?: string;
    signal?: AbortSignal;
    retry?: { maxAttempts?: number; initialDelayMs?: number };
  },
): Promise<WikidataSparqlBinding[]> {
  const userAgent = options?.userAgent ?? getWikidataUserAgent();
  const url = new URL(WIKIDATA_SPARQL_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", query);

  const response = await withRetry(
    async () => {
      const res = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": userAgent,
        },
        signal: options?.signal,
      });
      if (!res.ok) {
        throw res;
      }
      return res;
    },
    {
      maxAttempts: options?.retry?.maxAttempts,
      initialDelayMs: options?.retry?.initialDelayMs,
      onRetry: (error, attempt, delayMs) => {
        logger.warn(`Wikidata SPARQL retry ${attempt}`, {
          delayMs,
          error: error instanceof Response ? error.status : String(error),
        });
      },
    },
  );

  const json = (await response.json()) as SparqlResponse;
  return json.results?.bindings ?? [];
}

function countUniqueItems(pages: WikidataSparqlPage[]): number {
  const ids = new Set<string>();
  for (const page of pages) {
    for (const binding of page.bindings) {
      const item = binding.item;
      if (item?.type === "uri") {
        const qid = parseWikidataQid(item.value);
        if (qid) ids.add(qid);
      }
    }
  }
  return ids.size;
}

async function fetchWithModeFallback(
  entity: PaginatedFetchOptions["entity"],
  offset: number,
  pageSize: number,
  modes: WikidataQueryMode[],
): Promise<FetchPageResult> {
  const queries = getQueriesForEntity(entity);
  let lastError: unknown;

  for (const mode of modes) {
    try {
      const query = buildPaginatedQuery(queries[mode], offset, pageSize);
      const bindings = await fetchSparqlPage(query);
      return { bindings, queryMode: mode };
    } catch (error) {
      lastError = error;
      logger.warn(`Wikidata query mode ${mode} failed for ${entity}`, {
        offset,
        error: error instanceof Response ? error.status : String(error),
      });
    }
  }

  throw lastError ?? new Error(`All Wikidata query modes failed for ${entity}`);
}

export async function fetchAllRawPages(
  options: PaginatedFetchOptions,
): Promise<PaginatedFetchSummary> {
  const pageSize = options.pageSize ?? 200;
  const delayMs = options.delayMs ?? 2000;
  const maxRows = options.maxRows ?? Infinity;
  const modes: WikidataQueryMode[] = options.allowLiteFallback
    ? ["full", "core", "lite"]
    : ["full", "core"];

  const pages: WikidataSparqlPage[] = [];
  let offset = 0;
  let queryMode: WikidataQueryMode = "full";
  let usedLiteFallback = false;

  while (offset < maxRows) {
    const limit = Math.min(pageSize, maxRows - offset);
    const result = await fetchWithModeFallback(options.entity, offset, limit, modes);
    queryMode = result.queryMode;
    if (result.queryMode === "lite") usedLiteFallback = true;

    const page: WikidataSparqlPage = {
      offset,
      pageSize: limit,
      queryMode: result.queryMode,
      bindingCount: result.bindings.length,
      bindings: result.bindings,
    };
    pages.push(page);
    await options.onPage?.(page);

    if (result.bindings.length < limit) break;
    offset += limit;
    if (delayMs > 0) await sleep(delayMs);
  }

  const totalBindings = pages.reduce((sum, p) => sum + p.bindingCount, 0);
  logger.info(`Fetched ${options.entity} pages`, {
    pageCount: pages.length,
    totalBindings,
    uniqueItemCount: countUniqueItems(pages),
    queryMode,
  });

  return { queryMode, pages, totalBindings, usedLiteFallback };
}

export { countUniqueItems, parseWikidataQid };
