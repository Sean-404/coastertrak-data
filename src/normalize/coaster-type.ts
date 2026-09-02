/** Infer a coarse coaster type label from Wikidata P31 class or manufacturer hints. */

export function inferCoasterType(clsLabel: string | null | undefined): string | null {
  const label = (clsLabel ?? "").toLowerCase();
  if (!label) return null;
  if (label.includes("wood")) return "Wood";
  if (label.includes("steel")) return "Steel";
  if (label.includes("hybrid")) return "Hybrid";
  if (label.includes("inverted")) return "Inverted";
  if (label.includes("flying")) return "Flying";
  if (label.includes("launched")) return "Launched";
  if (label.includes("mine train")) return "Mine Train";
  if (label.includes("roller coaster") || label.includes("rollercoaster")) return "Steel";
  return null;
}
