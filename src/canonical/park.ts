import { z } from "zod";

import {
  coordinatesSchema,
  sourcedValueSchema,
  sourceIdsSchema,
  verificationMetaSchema,
} from "./provenance.js";
import { parkStatusSchema } from "./status.js";
import { isoCountryCodeSchema } from "./country.js";

const sourcedString = sourcedValueSchema(z.string().min(1));
const sourcedCountryCode = sourcedValueSchema(isoCountryCodeSchema);
const sourcedCoordinates = sourcedValueSchema(coordinatesSchema);
const sourcedUrl = sourcedValueSchema(z.string().url());

export const canonicalParkSchema = z.object({
  id: z.string().min(1),
  sourceIds: sourceIdsSchema,
  name: sourcedString,
  aliases: z.array(z.string()).default([]),
  countryCode: sourcedCountryCode,
  status: parkStatusSchema,
  coordinates: sourcedCoordinates.nullable(),
  website: sourcedUrl.nullable(),
  verification: verificationMetaSchema,
});
export type CanonicalPark = z.infer<typeof canonicalParkSchema>;

export const canonicalParkListSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  parks: z.array(canonicalParkSchema),
});
export type CanonicalParkList = z.infer<typeof canonicalParkListSchema>;
