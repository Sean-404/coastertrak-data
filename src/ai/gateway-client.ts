import { z } from "zod";

import {
  AI_GATEWAY_BASE_URL,
  AI_REVIEW_DEFAULT_MODEL,
  AI_REVIEW_MAX_OUTPUT_TOKENS,
} from "./config.js";
import { aiReviewBatchResponseSchema } from "./types.js";

export type GatewayChatOptions = {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
};

function resolveApiKey(explicit?: string): string {
  const key = explicit ?? process.env.AI_GATEWAY_API_KEY?.trim();
  if (key) return key;
  const oidc = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (oidc) return oidc;
  throw new Error(
    "Missing AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN). Add AI_GATEWAY_API_KEY to .env.local.",
  );
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fenced ? fenced[1]!.trim() : trimmed;

  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1));
    }
    throw new Error(`Could not parse JSON from model output: ${body.slice(0, 200)}`);
  }
}

export async function reviewBatchWithGateway(
  contexts: unknown[],
  options: GatewayChatOptions = {},
): Promise<{ assessments: z.infer<typeof aiReviewBatchResponseSchema>["assessments"]; usage: { input: number; output: number } }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = resolveApiKey(options.apiKey);
  const model = options.model ?? process.env.AI_GATEWAY_MODEL?.trim() ?? AI_REVIEW_DEFAULT_MODEL;

  const systemPrompt = `You review theme-park catalog data quality for CoasterTrak.
For each item, judge whether the catalog record is PLAUSIBLE (likely correct) or likely WRONG.
Focus on: park–coaster geography/country alignment, missing links, suspicious stats, duplicate plausibility.
Respond with JSON only: {"assessments":[{"itemKey":"...","plausible":true|false,"confidence":"LOW|MEDIUM|HIGH","issue":"max 120 chars","suggestedAction":"max 80 chars or omit"}]}
Do not invent facts. If unsure, plausible=false and confidence=LOW.`;

  const userPayload = JSON.stringify(contexts);
  const userPrompt = `Review these ${contexts.length} catalog quality flags:\n${userPayload}`;

  const response = await fetchImpl(`${AI_GATEWAY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: options.maxTokens ?? AI_REVIEW_MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI Gateway request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI Gateway returned empty content");

  let parsed: unknown;
  try {
    parsed = extractJsonObject(content);
  } catch (error) {
    throw new Error(
      `AI Gateway returned non-JSON: ${error instanceof Error ? error.message : content.slice(0, 200)}`,
    );
  }

  const validated = aiReviewBatchResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI response schema mismatch: ${validated.error.message}`);
  }

  return {
    assessments: validated.data.assessments,
    usage: {
      input: json.usage?.prompt_tokens ?? estimateTokens(systemPrompt + userPrompt),
      output: json.usage?.completion_tokens ?? estimateTokens(content),
    },
  };
}
