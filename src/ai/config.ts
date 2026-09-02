/** Hard caps to keep AI review runs cheap. Override via CLI flags only within these bounds. */
export const AI_REVIEW_DEFAULT_LIMIT = 20;
export const AI_REVIEW_MAX_LIMIT = 40;
export const AI_REVIEW_BATCH_SIZE = 3;
export const AI_REVIEW_MAX_OUTPUT_TOKENS = 2000;

/** Cheap default — override with AI_GATEWAY_MODEL if needed. */
export const AI_REVIEW_DEFAULT_MODEL = "google/gemini-2.5-flash";

export const AI_GATEWAY_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL?.trim() || "https://ai-gateway.vercel.sh/v1";

/** Rough $/1M tokens for dry-run estimates (input / output). */
export const AI_REVIEW_COST_ESTIMATE_PER_1M = {
  input: 0.15,
  output: 0.6,
} as const;

export const AI_REVIEW_PRIORITY: Record<string, number> = {
  MISSING_DATA: 0,
  COUNTRY_CONFLICT: 1,
  SUSPICIOUS_VALUE: 2,
  POSSIBLE_DUPLICATE: 3,
};
