import type { WikidataBindingValue, WikidataSparqlBinding } from "./types.js";
import { parseWikidataQid } from "../../lib/ids.js";

export function bindingLiteral(b: WikidataBindingValue | undefined): string | null {
  if (!b || b.type !== "literal") return null;
  return b.value;
}

export function bindingUri(b: WikidataBindingValue | undefined): string | null {
  if (!b || b.type !== "uri") return null;
  return b.value;
}

export function bindingNumber(b: WikidataBindingValue | undefined): number | null {
  const value = bindingLiteral(b);
  if (value == null) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function bindingQid(b: WikidataBindingValue | undefined): string | null {
  const uri = bindingUri(b);
  if (!uri) return null;
  return parseWikidataQid(uri);
}

export function wikimediaImageUrl(b: WikidataBindingValue | undefined): string | null {
  if (!b) return null;
  const raw = b.value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/^http:\/\//i, "https://");
  }
  const fileName = raw.replace(/^File:/i, "").trim();
  if (!fileName) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
}

export function collectBindingsByItem(
  bindings: WikidataSparqlBinding[],
): Map<string, WikidataSparqlBinding[]> {
  const byItem = new Map<string, WikidataSparqlBinding[]>();
  for (const binding of bindings) {
    const qid = bindingQid(binding.item);
    if (!qid) continue;
    const list = byItem.get(qid) ?? [];
    list.push(binding);
    byItem.set(qid, list);
  }
  return byItem;
}

export function mergeBindings(bindings: WikidataSparqlBinding[]): WikidataSparqlBinding {
  const merged: WikidataSparqlBinding = {};
  for (const binding of bindings) {
    for (const [key, value] of Object.entries(binding)) {
      if (value && !merged[key]) merged[key] = value;
    }
  }
  return merged;
}
