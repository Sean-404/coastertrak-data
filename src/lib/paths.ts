import { join } from "node:path";

/** ISO-ish folder name safe for filesystems (UTC). */
export function newRunId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function rawRunDir(source: string, runId: string, dataRoot = "data"): string {
  return join(dataRoot, "raw", source, runId);
}

export function processedRunDir(source: string, runId: string, dataRoot = "data"): string {
  return join(dataRoot, "processed", source, runId);
}

export function reportDir(source: string, runId: string, dataRoot = "data"): string {
  return join(dataRoot, "reports", source, runId);
}

export function outputDir(dataRoot = "data"): string {
  return join(dataRoot, "output");
}

export function reviewDir(dataRoot = "data"): string {
  return join(dataRoot, "review");
}

export function overridesDir(dataRoot = "data"): string {
  return join(dataRoot, "overrides");
}

export function wikidataRawRunDir(runId: string, dataRoot = "data"): string {
  return rawRunDir("wikidata", runId, dataRoot);
}

export function formatPageFileName(offset: number): string {
  return `${String(offset).padStart(6, "0")}.json`;
}

export function fixturesDir(): string {
  return join(process.cwd(), "fixtures");
}

export function wikidataFixturePagesDir(entity: "coasters" | "parks"): string {
  return join(fixturesDir(), "wikidata", "raw-pages", entity);
}
