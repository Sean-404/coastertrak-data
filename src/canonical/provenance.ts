import { z } from "zod";

export const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const provenanceRecordSchema = z.object({
  source: z.string().min(1),
  sourceId: z.string().optional(),
  retrievedAt: z.string().datetime(),
  rawValue: z.unknown().optional(),
});
export type ProvenanceRecord = z.infer<typeof provenanceRecordSchema>;

export function sourcedValueSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    provenance: z.array(provenanceRecordSchema).min(1),
    confidence: confidenceSchema.optional(),
  });
}

export type SourcedValue<T> = {
  value: T;
  provenance: ProvenanceRecord[];
  confidence?: Confidence;
};

export const verificationMetaSchema = z.object({
  qualityScore: confidenceSchema.optional(),
  needsReview: z.boolean().default(false),
  reviewReasons: z.array(z.string()).default([]),
});
export type VerificationMeta = z.infer<typeof verificationMetaSchema>;

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

export const quantityUnitSchema = z.enum(["m", "m/s", "s", "count"]);
export type QuantityUnit = z.infer<typeof quantityUnitSchema>;

export const quantitySchema = z.object({
  value: z.number(),
  unit: quantityUnitSchema,
});
export type Quantity = z.infer<typeof quantitySchema>;

export const sourceIdsSchema = z
  .object({
    wikidata: z.string().optional(),
    rcdb: z.string().optional(),
    enwiki: z.string().optional(),
  })
  .passthrough();
export type SourceIds = z.infer<typeof sourceIdsSchema>;
