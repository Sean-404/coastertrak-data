/** SPARQL queries for Wikidata — coaster and park entities are fetched separately. */

export const WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

export const WIKIDATA_LABEL_LANGUAGES = "en,mul,en-gb,en-ca,nl,fr,de";

const LABEL_SERVICE = `SERVICE wikibase:label { bd:serviceParam wikibase:language "${WIKIDATA_LABEL_LANGUAGES}". }`;

const COMMON_PREFIXES = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
`;

/** Roller coasters: instances/subclasses of Q204832 (WikiProject Roller Coasters). */
export const COASTER_QUERIES = {
  full: `
${COMMON_PREFIXES}
SELECT ?item ?itemLabel ?coord ?countryLabel ?parkLabel ?manufacturerLabel
  ?clsLabel
  ?lengthM ?speedMs ?heightM ?durationS
  ?opening ?retirement ?demolished ?rcdbId ?enwiki ?image
  ?park ?parkParent ?parkParentLabel
WHERE {
  ?item wdt:P31 ?cls .
  ?cls wdt:P279* wd:Q204832 .
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P361 ?park . }
  OPTIONAL {
    ?park wdt:P361 ?parkParent .
    FILTER(
      EXISTS { ?parkParent wdt:P31 wd:Q2416723 . }
      || EXISTS { ?parkParent wdt:P31 wd:Q3363942 . }
    )
    FILTER( NOT EXISTS { ?parkParent wdt:P31 wd:Q875912 . } )
  }
  OPTIONAL { ?item wdt:P176 ?manufacturer . }
  OPTIONAL { ?item p:P2043/psn:P2043/wikibase:quantityAmount ?lengthM . }
  OPTIONAL { ?item p:P2052/psn:P2052/wikibase:quantityAmount ?speedMs . }
  OPTIONAL { ?item p:P2048/psn:P2048/wikibase:quantityAmount ?heightM . }
  OPTIONAL { ?item p:P2047/psn:P2047/wikibase:quantityAmount ?durationS . }
  OPTIONAL { ?item wdt:P1619 ?opening . }
  OPTIONAL { ?item wdt:P730 ?retirement . }
  OPTIONAL { ?item wdt:P576 ?demolished . }
  OPTIONAL { ?item wdt:P2751 ?rcdbId . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> ;
             schema:name ?enwiki .
  }
  ${LABEL_SERVICE}
}
`,
  core: `
${COMMON_PREFIXES}
SELECT ?item ?itemLabel ?coord ?countryLabel ?parkLabel ?manufacturerLabel
  ?clsLabel
  ?lengthM ?speedMs ?heightM ?durationS
  ?opening ?retirement ?demolished ?rcdbId ?enwiki ?image
  ?park
WHERE {
  ?item wdt:P31 ?cls .
  ?cls wdt:P279* wd:Q204832 .
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P361 ?park . }
  OPTIONAL { ?item wdt:P176 ?manufacturer . }
  OPTIONAL { ?item p:P2043/psn:P2043/wikibase:quantityAmount ?lengthM . }
  OPTIONAL { ?item p:P2052/psn:P2052/wikibase:quantityAmount ?speedMs . }
  OPTIONAL { ?item p:P2048/psn:P2048/wikibase:quantityAmount ?heightM . }
  OPTIONAL { ?item p:P2047/psn:P2047/wikibase:quantityAmount ?durationS . }
  OPTIONAL { ?item wdt:P1619 ?opening . }
  OPTIONAL { ?item wdt:P730 ?retirement . }
  OPTIONAL { ?item wdt:P576 ?demolished . }
  OPTIONAL { ?item wdt:P2751 ?rcdbId . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> ;
             schema:name ?enwiki .
  }
  ${LABEL_SERVICE}
}
`,
  lite: `
${COMMON_PREFIXES}
SELECT ?item ?itemLabel ?coord ?countryLabel ?parkLabel ?manufacturerLabel
  ?clsLabel ?opening ?retirement ?demolished ?rcdbId ?enwiki ?image ?park
WHERE {
  ?item wdt:P31 ?cls .
  ?cls wdt:P279* wd:Q204832 .
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P361 ?park . }
  OPTIONAL { ?item wdt:P176 ?manufacturer . }
  OPTIONAL { ?item wdt:P1619 ?opening . }
  OPTIONAL { ?item wdt:P730 ?retirement . }
  OPTIONAL { ?item wdt:P576 ?demolished . }
  OPTIONAL { ?item wdt:P2751 ?rcdbId . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> ;
             schema:name ?enwiki .
  }
  ${LABEL_SERVICE}
}
`,
} as const;

/** Theme/amusement parks: Q2416723 and Q3363942, excluding resorts (Q875912). */
export const PARK_QUERIES = {
  full: `
${COMMON_PREFIXES}
SELECT ?item ?itemLabel ?coord ?countryLabel ?website ?opening ?closing
WHERE {
  ?item wdt:P31 ?cls .
  {
    ?cls wdt:P279* wd:Q2416723 .
  } UNION {
    ?cls wdt:P279* wd:Q3363942 .
  }
  FILTER( NOT EXISTS { ?item wdt:P31 wd:Q875912 . } )
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P1619 ?opening . }
  OPTIONAL { ?item wdt:P3999 ?closing . }
  ${LABEL_SERVICE}
}
`,
  core: `
${COMMON_PREFIXES}
SELECT ?item ?itemLabel ?coord ?countryLabel ?website
WHERE {
  ?item wdt:P31 ?cls .
  {
    ?cls wdt:P279* wd:Q2416723 .
  } UNION {
    ?cls wdt:P279* wd:Q3363942 .
  }
  FILTER( NOT EXISTS { ?item wdt:P31 wd:Q875912 . } )
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P17 ?country . }
  OPTIONAL { ?item wdt:P856 ?website . }
  ${LABEL_SERVICE}
}
`,
  lite: `
${COMMON_PREFIXES}
SELECT ?item ?itemLabel ?coord ?countryLabel
WHERE {
  ?item wdt:P31 ?cls .
  {
    ?cls wdt:P279* wd:Q2416723 .
  } UNION {
    ?cls wdt:P279* wd:Q3363942 .
  }
  FILTER( NOT EXISTS { ?item wdt:P31 wd:Q875912 . } )
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P17 ?country . }
  ${LABEL_SERVICE}
}
`,
} as const;

export function getQueriesForEntity(entity: "coasters" | "parks") {
  return entity === "coasters" ? COASTER_QUERIES : PARK_QUERIES;
}

export function buildPaginatedQuery(baseQuery: string, offset: number, limit: number): string {
  return `${baseQuery.trim()}\nLIMIT ${limit}\nOFFSET ${offset}\n`;
}
