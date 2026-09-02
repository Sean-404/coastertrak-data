/** String similarity helpers for entity matching. */

export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }

  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigrams.get(bg) ?? 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      hits++;
    }
  }

  return (2 * hits) / (a.length - 1 + (b.length - 1));
}

export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW";

export function confidenceFromScore(score: number): MatchConfidence {
  if (score >= 0.92) return "HIGH";
  if (score >= 0.8) return "MEDIUM";
  return "LOW";
}
