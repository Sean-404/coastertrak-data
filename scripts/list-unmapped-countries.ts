import { normaliseCountryToIso } from "../src/canonical/country.js";
import { createSupabaseClient } from "../src/lib/supabase.js";

async function main() {
  const client = createSupabaseClient();
  const { data } = await client.from("parks").select("id,name,country").order("id");
  const bad = (data ?? []).filter((p) => !normaliseCountryToIso(p.country));

  console.log(`Unmapped countries (${bad.length} parks):`);
  const byCountry = new Map<string, string[]>();
  for (const p of bad) {
    const k = p.country ?? "(null)";
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k)!.push(p.name);
  }
  for (const [country, names] of [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${country}: ${names.length} — ${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}`);
  }
}

void main();
