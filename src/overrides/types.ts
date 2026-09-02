import { z } from "zod";

export const overrideMatchSchema = z
  .object({
    id: z.string().optional(),
    "sourceIds.wikidata": z.string().optional(),
  })
  .refine((m) => m.id ?? m["sourceIds.wikidata"], {
    message: "Override match requires id or sourceIds.wikidata",
  });

export const parkOverridePatchSchema = z.object({
  countryCode: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  aliases: z.array(z.string()).optional(),
});

export const coasterOverridePatchSchema = z.object({
  countryCode: z.string().optional(),
  name: z.string().optional(),
  parkId: z.string().optional(),
  status: z.string().optional(),
  manufacturer: z.string().optional(),
  height: z.number().optional(),
  speed: z.number().optional(),
  length: z.number().optional(),
  inversions: z.number().optional(),
});

export const parkOverrideEntrySchema = z.object({
  match: overrideMatchSchema,
  patch: parkOverridePatchSchema,
  reason: z.string().min(1),
  appliedBy: z.string().default("manual"),
  appliedAt: z.string().datetime(),
});

export const coasterOverrideEntrySchema = z.object({
  match: overrideMatchSchema,
  patch: coasterOverridePatchSchema,
  reason: z.string().min(1),
  appliedBy: z.string().default("manual"),
  appliedAt: z.string().datetime(),
});

export const parkOverridesFileSchema = z.object({
  version: z.literal(1),
  overrides: z.array(parkOverrideEntrySchema),
});

export const coasterOverridesFileSchema = z.object({
  version: z.literal(1),
  overrides: z.array(coasterOverrideEntrySchema),
});

export type ParkOverrideEntry = z.infer<typeof parkOverrideEntrySchema>;
export type CoasterOverrideEntry = z.infer<typeof coasterOverrideEntrySchema>;
export type ParkOverridesFile = z.infer<typeof parkOverridesFileSchema>;
export type CoasterOverridesFile = z.infer<typeof coasterOverridesFileSchema>;
