import type { Coordinates } from "../canonical/provenance.js";

/** Parse WKT Point(lon lat) from Wikidata P625. */
export function parseWktPoint(wkt: string | undefined | null): Coordinates | null {
  if (!wkt) return null;
  const match = /^Point\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i.exec(wkt.trim());
  if (!match) return null;
  const lng = Number.parseFloat(match[1]!);
  const lat = Number.parseFloat(match[2]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function isValidCoordinates(coords: Coordinates | null | undefined): boolean {
  if (!coords) return false;
  return (
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180
  );
}
