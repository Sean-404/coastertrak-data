export type RawIngestMeta = {
  generatedAt: string;
  source: string;
  runId: string;
  endpoint: string;
  mode: "fixture" | "live";
  entities: Array<"coasters" | "parks">;
  pageCount: number;
  totalBindings: number;
  options: Record<string, unknown>;
};

export type RawIngestResult = {
  runDir: string;
  meta: RawIngestMeta;
};

export type IngestOptions = {
  dataRoot?: string;
  runId?: string;
  /** When true, copy fixtures instead of querying Wikidata. Default in Phase 1. */
  fixture?: boolean;
  dryRun?: boolean;
  maxRows?: number;
  pageSize?: number;
  delayMs?: number;
  entities?: Array<"coasters" | "parks">;
  onProgress?: (message: string) => void;
};

/** Source adapter contract — Wikidata is the first implementation. */
export interface SourceAdapter {
  readonly sourceId: string;
  ingest(options?: IngestOptions): Promise<RawIngestResult>;
}
