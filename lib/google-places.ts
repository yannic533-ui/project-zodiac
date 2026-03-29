const PLACES_V1 = "https://places.googleapis.com/v1";

/** Field mask for Text Search (New); each field uses the `places.` prefix. */
const SEARCH_TEXT_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress";

/** Field mask for Place Details (New); single Place resource — no `places.` prefix. */
const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours",
  "priceLevel",
  "types",
  "photos",
  "editorialSummary",
  "businessStatus",
  "googleMapsUri",
].join(",");

type V1LocalizedText = { text?: string; languageCode?: string };

type V1Photo = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
};

type V1OpeningHours = {
  weekdayDescriptions?: string[];
};

type V1Place = {
  id?: string;
  displayName?: V1LocalizedText;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: V1OpeningHours;
  priceLevel?: string;
  types?: string[];
  photos?: V1Photo[];
  editorialSummary?: V1LocalizedText;
  businessStatus?: string;
  googleMapsUri?: string;
};

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
  /** New API: Google photo resource name (`places/.../photos/...`). Proxied via `/api/places/photo`. */
  photos?: { photo_reference: string; height: number; width: number }[];
  editorial_summary?: { overview?: string };
  business_status?: string;
  url?: string;
};

function mapPriceLevelEnum(level: string | undefined): number | undefined {
  if (!level) return undefined;
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[level];
}

function mapV1PlaceToDetails(p: V1Place): PlaceDetailsResult | null {
  const id = p.id?.trim();
  if (!id) return null;
  const name = p.displayName?.text?.trim() || id;
  const formatted_address = p.formattedAddress?.trim() || "";
  return {
    place_id: id,
    name,
    formatted_address,
    formatted_phone_number: p.nationalPhoneNumber,
    international_phone_number: p.internationalPhoneNumber,
    website: p.websiteUri,
    opening_hours: p.regularOpeningHours?.weekdayDescriptions?.length
      ? { weekday_text: p.regularOpeningHours.weekdayDescriptions }
      : undefined,
    price_level: mapPriceLevelEnum(p.priceLevel),
    types: p.types,
    photos: p.photos
      ?.filter((ph) => ph.name)
      .map((ph) => ({
        photo_reference: ph.name as string,
        height: ph.heightPx ?? 0,
        width: ph.widthPx ?? 0,
      })),
    editorial_summary: p.editorialSummary?.text
      ? { overview: p.editorialSummary.text }
      : undefined,
    business_status: p.businessStatus,
    url: p.googleMapsUri,
  };
}

async function readPlacesError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      error?: { message?: string; status?: string };
    };
    return j.error?.message ?? j.error?.status ?? `Places HTTP ${res.status}`;
  } catch {
    return `Places HTTP ${res.status}`;
  }
}

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

export async function textSearchPlaces(
  query: string,
  apiKey: string,
  languageCode: string = "de"
): Promise<{ place_id: string; name: string; formatted_address?: string }[]> {
  const res = await fetch(`${PLACES_V1}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_TEXT_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode,
      locationBias: {
        circle: {
          center: { latitude: 47.3769, longitude: 8.5417 },
          radius: 50000.0,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(await readPlacesError(res));
  }

  const data = (await res.json()) as { places?: V1Place[] };
  const list = data.places ?? [];
  return list
    .map((pl) => {
      const id = pl.id?.trim();
      if (!id) return null;
      return {
        place_id: id,
        name: pl.displayName?.text?.trim() || id,
        formatted_address: pl.formattedAddress,
      };
    })
    .filter(Boolean) as {
    place_id: string;
    name: string;
    formatted_address?: string;
  }[];
}

export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  languageCode: string = "de"
): Promise<PlaceDetailsResult | null> {
  const id = placeId.trim();
  const url = new URL(`${PLACES_V1}/places/${encodeURIComponent(id)}`);
  url.searchParams.set("languageCode", languageCode);

  const res = await fetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
    },
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(await readPlacesError(res));
  }

  const place = (await res.json()) as V1Place;
  return mapV1PlaceToDetails(place);
}

/** Build same-origin photo URL for the Next.js proxy (Places API New media). */
export function placePhotoProxyUrl(
  photoResourceName: string,
  maxWidthPx = 800
): string {
  return `/api/places/photo?name=${encodeURIComponent(photoResourceName)}&maxWidthPx=${maxWidthPx}`;
}
