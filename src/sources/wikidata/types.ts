export type WikidataBindingValue = {
  type: "uri" | "literal" | "bnode";
  value: string;
  "xml:lang"?: string;
  datatype?: string;
};

export type WikidataSparqlBinding = Record<string, WikidataBindingValue | undefined>;

export type WikidataSparqlPage = {
  offset: number;
  pageSize: number;
  queryMode: WikidataQueryMode;
  bindingCount: number;
  bindings: WikidataSparqlBinding[];
};

export type WikidataQueryMode = "full" | "core" | "lite";

export type WikidataEntityKind = "coasters" | "parks";

export type WikidataRawPageFile = WikidataSparqlPage;

export type WikidataRawRunMeta = {
  generatedAt: string;
  source: "wikidata";
  runId: string;
  endpoint: string;
  mode: "fixture" | "live";
  coasters?: {
    queryMode: WikidataQueryMode;
    pageCount: number;
    totalBindings: number;
    uniqueItemCount: number;
  };
  parks?: {
    queryMode: WikidataQueryMode;
    pageCount: number;
    totalBindings: number;
    uniqueItemCount: number;
  };
  options: Record<string, unknown>;
};

export type FetchPageResult = {
  bindings: WikidataSparqlBinding[];
  queryMode: WikidataQueryMode;
};

export type PaginatedFetchOptions = {
  entity: WikidataEntityKind;
  maxRows?: number;
  pageSize?: number;
  delayMs?: number;
  allowLiteFallback?: boolean;
  onPage?: (page: WikidataSparqlPage) => void | Promise<void>;
  onPaginationRestart?: () => void | Promise<void>;
};

export type PaginatedFetchSummary = {
  queryMode: WikidataQueryMode;
  pages: WikidataSparqlPage[];
  totalBindings: number;
  usedLiteFallback: boolean;
};
