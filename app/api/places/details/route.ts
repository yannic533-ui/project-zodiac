import { NextResponse } from "next/server";
import { fetchPlaceDetails } from "@/lib/google-places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 500 }
    );
  }

  const placeId = new URL(request.url).searchParams.get("place_id");
  if (!placeId?.trim()) {
    return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
  }

  try {
    const place = await fetchPlaceDetails(placeId.trim(), key);
    if (!place) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ place });
  } catch (e) {
    console.error("[places/details]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Details failed" },
      { status: 502 }
    );
  }
}
