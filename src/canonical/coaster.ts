import { z } from "zod";

import {
  coordinatesSchema,
  quantitySchema,
  sourcedValueSchema,
  sourceIdsSchema,
  verificationMetaSchema,
} from "./provenance.js";
import { coasterStatusSchema } from "./status.js";
import { isoCountryCodeSchema } from "./country.js";

const sourcedString = sourcedValueSchema(z.string().min(1));
const sourcedCountryCode = sourcedValueSchema(isoCountryCodeSchema);
const sourcedCoordinates = sourcedValueSchema(coordinatesSchema);
const sourcedQuantity = sourcedValueSchema(quantitySchema);
const sourcedNumber = sourcedValueSchema(z.number());
const sourcedDate = sourcedValueSchema(
  z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, "Expected ISO date YYYY or YYYY-MM-DD"),
);
const sourcedUrl = sourcedValueSchema(z.string().url());

export const canonicalCoasterSchema = z.object({
  id: z.string().min(1),
  sourceIds: sourceIdsSchema,
  name: sourcedString,
  aliases: z.array(z.string()).default([]),
  parkId: z.string().nullable(),
  countryCode: sourcedCountryCode.nullable(),
  manufacturer: sourcedString.nullable(),
  model: sourcedString.nullable(),
  coasterType: sourcedString.nullable(),
  status: coasterStatusSchema,
  openingDate: sourcedDate.nullable(),
  closingDate: sourcedDate.nullable(),
  height: sourcedQuantity.nullable(),
  speed: sourcedQuantity.nullable(),
  length: sourcedQuantity.nullable(),
  inversions: sourcedNumber.nullable(),
  duration: sourcedNumber.nullable(),
  coordinates: sourcedCoordinates.nullable(),
  description: sourcedString.nullable(),
  imageUrl: sourcedUrl.nullable(),
  verification: verificationMetaSchema,
});
export type CanonicalCoaster = z.infer<typeof canonicalCoasterSchema>;

export const canonicalCoasterListSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  coasters: z.array(canonicalCoasterSchema),
});
export type CanonicalCoasterList = z.infer<typeof canonicalCoasterListSchema>;
