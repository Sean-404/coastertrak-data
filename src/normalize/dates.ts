/** Wikidata time: +1990-03-17T00:00:00Z or year-precision +1990-00-00... */
export function parseWikidataDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const yearOnly = /^([+-]?\d{4})-00-00/.exec(raw);
  if (yearOnly) return yearOnly[1]!.replace(/^\+/, "");
  const full = /^([+-]?\d{4}-\d{2}-\d{2})/.exec(raw);
  if (full) return full[1]!.replace(/^\+/, "");
  const year = /^([+-]?\d{4})/.exec(raw);
  if (year) return year[1]!.replace(/^\+/, "");
  return null;
}

export function extractYear(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
}

export function isOpeningDateInFuture(openingDate: string | null | undefined): boolean {
  if (!openingDate) return false;
  const year = extractYear(openingDate);
  if (year == null) return false;
  return year > new Date().getUTCFullYear() + 2;
}

export function isClosingBeforeOpening(
  openingDate: string | null | undefined,
  closingDate: string | null | undefined,
): boolean {
  if (!openingDate || !closingDate) return false;
  const openYear = extractYear(openingDate);
  const closeYear = extractYear(closingDate);
  if (openYear == null || closeYear == null) return false;
  if (openYear !== closeYear) return closeYear < openYear;
  return closingDate < openingDate;
}
