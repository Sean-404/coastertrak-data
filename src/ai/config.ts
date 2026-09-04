/** Hard caps to keep AI review runs cheap. Override via CLI flags only within these bounds. */
export const AI_REVIEW_DEFAULT_LIMIT = 20;
export const AI_REVIEW_MAX_LIMIT = 40;
export const AI_REVIEW_BATCH_SIZE = 2;
export const AI_REVIEW_MAX_OUTPUT_TOKENS = 4000;

/** Cheap default — override with AI_GATEWAY_MODEL if needed. */
export const AI_REVIEW_DEFAULT_MODEL = "google/gemini-2.5-flash";

export const AI_GATEWAY_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL?.trim() || "https://ai-gateway.vercel.sh/v1";

/** Rough $/1M tokens for dry-run estimates (input / output). */
export const AI_REVIEW_COST_ESTIMATE_PER_1M = {
  input: 0.15,
  output: 0.6,
} as const;

/**
 * Lower number = earlier selection.
 * Missing field completeness is factual (not AI judgment) — excluded by default; last if included.
 */
export const AI_REVIEW_PRIORITY: Record<string, number> = {
  COUNTRY_CONFLICT: 1,
  SUSPICIOUS_VALUE: 2,
  POSSIBLE_DUPLICATE: 3,
  MISSING_DATA: 10,
};
