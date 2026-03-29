import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractPlaceIdFromInput,
  fetchPlaceDetails,
  textSearchPlaces,
} from "@/lib/google-places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  query: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 500 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const raw = parsed.data.query.trim();
  try {
    const fromUrl = extractPlaceIdFromInput(raw);
    if (fromUrl) {
      const place = await fetchPlaceDetails(fromUrl, key);
      if (place) {
        return NextResponse.json({ mode: "single" as const, place });
      }
    }

    const results = await textSearchPlaces(raw, key);
    if (results.length === 1) {
      const place = await fetchPlaceDetails(results[0].place_id, key);
      if (place) {
        return NextResponse.json({ mode: "single" as const, place });
      }
    }

    return NextResponse.json({ mode: "list" as const, candidates: results });
  } catch (e) {
    console.error("[places/search]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 502 }
    );
  }
}
