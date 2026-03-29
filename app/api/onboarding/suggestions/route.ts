import { NextResponse } from "next/server";
import { z } from "zod";
import type { PlaceDetailsResult } from "@/lib/google-places";
import { generateOnboardingChipSuggestions } from "@/lib/onboarding-suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const placeSchema = z.object({
  place_id: z.string(),
  name: z.string(),
  formatted_address: z.string(),
  formatted_phone_number: z.string().optional(),
  international_phone_number: z.string().optional(),
  website: z.string().optional(),
  opening_hours: z
    .object({ weekday_text: z.array(z.string()).optional() })
    .optional(),
  price_level: z.number().optional(),
  types: z.array(z.string()).optional(),
  photos: z
    .array(
      z.object({
        photo_reference: z.string(),
        height: z.number().optional(),
        width: z.number().optional(),
      })
    )
    .optional(),
  editorial_summary: z.object({ overview: z.string().optional() }).optional(),
  business_status: z.string().optional(),
  url: z.string().optional(),
});

const bodySchema = z.object({
  place: placeSchema,
  languageCode: z.enum(["de", "en"]).optional(),
});

export async function POST(request: Request) {
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

  const place = parsed.data.place as PlaceDetailsResult;
  const languageCode = parsed.data.languageCode ?? "de";

  try {
    const chips = await generateOnboardingChipSuggestions({ place, language: languageCode });
    return NextResponse.json({ chips });
  } catch (e) {
    console.error("[onboarding/suggestions]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Suggestions failed" },
      { status: 502 }
    );
  }
}
