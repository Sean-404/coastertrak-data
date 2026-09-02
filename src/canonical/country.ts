import { z } from "zod";

/** ISO 3166-1 alpha-2 country codes used in the canonical model. */
export const isoCountryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Expected ISO 3166-1 alpha-2 country code");
export type IsoCountryCode = z.infer<typeof isoCountryCodeSchema>;

/** Common aliases → ISO alpha-2. Normalisation only; does not merge entities. */
const COUNTRY_ALIASES: Record<string, IsoCountryCode> = {
  us: "US",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states": "US",
  "united states of america": "US",
  "coney island": "US",
  uk: "GB",
  gb: "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  sg: "SG",
  singapore: "SG",
  my: "MY",
  malaysia: "MY",
  dk: "DK",
  denmark: "DK",
  de: "DE",
  germany: "DE",
  fr: "FR",
  france: "FR",
  jp: "JP",
  japan: "JP",
  hk: "HK",
  "hong kong": "HK",
  mo: "MO",
  macau: "MO",
  macao: "MO",
  tw: "TW",
  taiwan: "TW",
  cn: "CN",
  china: "CN",
  "people's republic of china": "CN",
  ca: "CA",
  canada: "CA",
  au: "AU",
  australia: "AU",
  nl: "NL",
  netherlands: "NL",
  es: "ES",
  spain: "ES",
  it: "IT",
  italy: "IT",
  se: "SE",
  sweden: "SE",
  no: "NO",
  norway: "NO",
  fi: "FI",
  finland: "FI",
  be: "BE",
  belgium: "BE",
  at: "AT",
  austria: "AT",
  ch: "CH",
  switzerland: "CH",
  pl: "PL",
  poland: "PL",
  cz: "CZ",
  czechia: "CZ",
  "czech republic": "CZ",
  kr: "KR",
  "south korea": "KR",
  korea: "KR",
  sa: "SA",
  "saudi arabia": "SA",
  ae: "AE",
  "united arab emirates": "AE",
  br: "BR",
  brazil: "BR",
  mx: "MX",
  mexico: "MX",
  in: "IN",
  india: "IN",
  ru: "RU",
  russia: "RU",
  ie: "IE",
  ireland: "IE",
  nz: "NZ",
  "new zealand": "NZ",
  za: "ZA",
  "south africa": "ZA",
  eg: "EG",
  egypt: "EG",
  ma: "MA",
  morocco: "MA",
  ng: "NG",
  nigeria: "NG",
  ke: "KE",
  kenya: "KE",
  tn: "TN",
  tunisia: "TN",
  dz: "DZ",
  algeria: "DZ",
  gh: "GH",
  ghana: "GH",
  ar: "AR",
  argentina: "AR",
  gt: "GT",
  guatemala: "GT",
  hu: "HU",
  hungary: "HU",
  vn: "VN",
  vietnam: "VN",
  ph: "PH",
  philippines: "PH",
  pt: "PT",
  portugal: "PT",
  ro: "RO",
  romania: "RO",
};

/** Display names for export to CoasterTrak (label-based parks.country column). */
const ISO_TO_DISPLAY: Record<IsoCountryCode, string> = {
  US: "United States",
  GB: "United Kingdom",
  SG: "Singapore",
  MY: "Malaysia",
  DK: "Denmark",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  HK: "Hong Kong",
  TW: "Taiwan",
  PL: "Poland",
};

/**
 * Normalise a free-text country label or code to ISO alpha-2 where safe.
 * Returns null when the input cannot be mapped confidently.
 */
export function normaliseCountryToIso(raw: string | null | undefined): IsoCountryCode | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  const alias = COUNTRY_ALIASES[key];
  if (alias) return alias;

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase() as IsoCountryCode;
  }

  return null;
}

/** Validate that a string is a known ISO code in our lookup table. */
export function isKnownIsoCountryCode(code: string): code is IsoCountryCode {
  return isoCountryCodeSchema.safeParse(code).success && code in ISO_TO_DISPLAY;
}

/** Derive CoasterTrak display label from ISO code. Falls back to code if unknown. */
export function countryDisplayName(code: IsoCountryCode | string): string {
  return ISO_TO_DISPLAY[code as IsoCountryCode] ?? code;
}

export const countryCodeSourcedSchema = z.object({
  value: isoCountryCodeSchema,
  provenance: z.array(z.unknown()).optional(),
});
