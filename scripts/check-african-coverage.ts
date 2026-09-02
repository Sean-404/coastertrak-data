const COASTER_QUERY = `
SELECT ?item ?itemLabel ?parkLabel ?countryLabel ?coord
WHERE {
  ?item wdt:P31/wdt:P279* wd:Q204832 .
  ?item wdt:P17 ?country .
  ?country wdt:P30 wd:Q15 .
  OPTIONAL { ?item wdt:P361 ?park . }
  OPTIONAL { ?item wdt:P625 ?coord . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;

async function sparql(query: string) {
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "coastertrak-data/0.2 (catalog research)",
    },
  });
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`);
  return (await res.json()) as {
    results: { bindings: Array<Record<string, { value: string }>> };
  };
}

async function main() {
  const json = await sparql(COASTER_QUERY);
  console.log("African roller coasters on Wikidata:");
  for (const row of json.results.bindings) {
    console.log(
      `  ${row.item?.value?.split("/").pop()} ${row.itemLabel?.value} — park: ${row.parkLabel?.value ?? "(none)"} — ${row.countryLabel?.value} — coord: ${row.coord?.value ?? "(none)"}`,
    );
  }

  const goldReef = await sparql(`
SELECT ?item ?itemLabel WHERE {
  ?item rdfs:label "Gold Reef City"@en .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 5`);
  console.log("\nGold Reef City entities:");
  for (const row of goldReef.results.bindings) {
    console.log(`  ${row.item?.value?.split("/").pop()} ${row.itemLabel?.value}`);
  }
}

void main();
