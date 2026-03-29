const DETAILS_FIELDS = [
  "place_id",
  "name",
  "formatted_address",
  "formatted_phone_number",
  "international_phone_number",
  "website",
  "opening_hours",
  "price_level",
  "types",
  "photos",
  "editorial_summary",
  "business_status",
  "url",
].join(",");

export type PlaceDetailsResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  opening_hours?: {
    weekday_text?: string[];
  };
  price_level?: number;
  types?: string[];
  photos?: { photo_reference: string; height: number; width: number }[];
  editorial_summary?: { overview?: string };
  business_status?: string;
  url?: string;
};

export function extractPlaceIdFromInput(input: string): string | null {
  const s = input.trim();
  const q = s.match(/[?&]place_id=([^&]+)/);
  if (q?.[1]) return decodeURIComponent(q[1]);
  const fid = s.match(/[!&]1s(ChIJ[A-Za-z0-9_-]+)/);
  if (fid?.[1]) return fid[1];
  const chij = s.match(/(ChIJ[A-Za-z0-9_-]{10,})/);
  if (chij?.[1]) return chij[1];
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Places HTTP ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

export async function textSearchPlaces(
  query: string,
  apiKey: string
): Promise<{ place_id: string; name: string; formatted_address?: string }[]> {
  const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  u.searchParams.set("query", query);
  u.searchParams.set("key", apiKey);
  const data = (await fetchJson(u.toString())) as {
    status: string;
    error_message?: string;
    results?: {
      place_id: string;
      name: string;
      formatted_address?: string;
    }[];
  };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(data.error_message ?? data.status);
  }
  return data.results ?? [];
}

export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceDetailsResult | null> {
  const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  u.searchParams.set("place_id", placeId);
  u.searchParams.set("fields", DETAILS_FIELDS);
  u.searchParams.set("key", apiKey);
  const data = (await fetchJson(u.toString())) as {
    status: string;
    error_message?: string;
    result?: PlaceDetailsResult;
  };
  if (data.status === "NOT_FOUND" || data.status === "INVALID_REQUEST") {
    return null;
  }
  if (data.status !== "OK" || !data.result) {
    throw new Error(data.error_message ?? data.status);
  }
  return data.result;
}

export function placePhotoUrl(photoReference: string, apiKey: string, maxWidth = 800): string {
  const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
  u.searchParams.set("maxwidth", String(maxWidth));
  u.searchParams.set("photo_reference", photoReference);
  u.searchParams.set("key", apiKey);
  return u.toString();
}
