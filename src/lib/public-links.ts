/** URL-safe slug fragment — mirrors CoasterTrak `slugify` for stable public links. */
export function slugifyName(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 80)
      .replace(/-+$/g, "") || "item"
  );
}

export function coasterPublicPath(name: string, dbId: number): string {
  return `/coasters/${slugifyName(name)}-${dbId}`;
}

/** Numeric CoasterTrak DB id when known (Supabase export sets `sourceIds.coastertrak`). */
export function resolveCoasterDbId(sourceIds: Record<string, unknown>, entityId: string): number | null {
  const raw = sourceIds.coastertrak;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
  const m = entityId.match(/^coaster_db_(\d+)$/);
  return m ? Number(m[1]) : null;
}
