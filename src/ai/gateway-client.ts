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

/** Pull complete assessment objects from truncated model JSON. */
export function salvageAssessmentsJson(text: string): { assessments: unknown[] } | null {
  const marker = text.match(/"assessments"\s*:\s*\[/);
  if (!marker || marker.index == null) return null;

  const items: unknown[] = [];
  let i = marker.index + marker[0].length;

  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i++;
    if (text[i] === "]") break;
    if (text[i] !== "{") break;

    let depth = 0;
    let inString = false;
    let escape = false;
    let j = i;
    for (; j < text.length; j++) {
      const c = text[j]!;
      if (inString) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (depth !== 0) break;

    try {
      items.push(JSON.parse(text.slice(i, j)));
    } catch {
      break;
    }
    i = j;
  }

  return items.length > 0 ? { assessments: items } : null;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fenced ? fenced[1]!.trim() : trimmed;

  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        // fall through to salvage
      }
    }
    const salvaged = salvageAssessmentsJson(body);
    if (salvaged) return salvaged;
    throw new Error(`Could not parse JSON from model output: ${body.slice(0, 200)}`);
  }
}

export async function reviewBatchWithGateway(
  contexts: unknown[],
  options: GatewayChatOptions = {},
): Promise<{
  assessments: z.infer<typeof aiReviewBatchResponseSchema>["assessments"];
  usage: { input: number; output: number };
}> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = resolveApiKey(options.apiKey);
  const model = options.model ?? process.env.AI_GATEWAY_MODEL?.trim() ?? AI_REVIEW_DEFAULT_MODEL;

  const systemPrompt = `You review theme-park catalog data quality for CoasterTrak.
For each item, judge whether the catalog record is PLAUSIBLE (likely correct) or likely WRONG.
Focus on: park–coaster geography/country alignment, suspicious stats, duplicate plausibility.
Respond with JSON only: {"assessments":[{"itemKey":"...","plausible":true|false,"confidence":"LOW|MEDIUM|HIGH","issue":"max 80 chars","suggestedAction":"max 60 chars or omit"}]}
Keep issue/suggestedAction short. Do not invent facts. If unsure, plausible=false and confidence=LOW.`;

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
    const err = new Error(
      `AI Gateway request failed (${response.status}): ${body.slice(0, 300)}`,
    ) as Error & { status?: number };
    err.status = response.status;
    throw err;
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
