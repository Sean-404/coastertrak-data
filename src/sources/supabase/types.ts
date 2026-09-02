export type SupabaseParkRow = {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  external_source: string | null;
  external_id: string | null;
  last_synced_at: string | null;
};

export type SupabaseCoasterRow = {
  id: number;
  park_id: number;
  name: string;
  coaster_type: string;
  manufacturer: string | null;
  status: string;
  external_source: string | null;
  external_id: string | null;
  wikidata_id: string | null;
  height_ft: number | null;
  speed_mph: number | null;
  length_ft: number | null;
  inversions: number | null;
  duration_s: number | null;
  opening_year: number | null;
  closing_year: number | null;
  enwiki_title: string | null;
  summary_text: string | null;
  image_url: string | null;
  last_synced_at: string | null;
};
