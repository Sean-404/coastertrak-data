import { z } from "zod";

export const aiReviewAssessmentSchema = z.object({
  itemKey: z.string(),
  plausible: z.boolean(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  issue: z.string().max(500),
  suggestedAction: z.string().max(500).optional(),
});

export type AiReviewAssessment = z.infer<typeof aiReviewAssessmentSchema>;

export const aiReviewBatchResponseSchema = z.object({
  assessments: z.array(aiReviewAssessmentSchema),
});

export type AiReviewReport = {
  version: 1;
  generatedAt: string;
  sourceRunId: string;
  model: string;
  itemsRequested: number;
  itemsReviewed: number;
  batches: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  assessments: AiReviewAssessment[];
};
