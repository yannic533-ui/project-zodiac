import { NextResponse } from "next/server";
import { z } from "zod";
import type { PlaceDetailsResult } from "@/lib/google-places";
import {
  generateOnboardingRiddlePack,
  regenerateOnboardingRiddle,
} from "@/lib/onboarding-riddles";
import { buildBarContextForClaude, type OnboardingQa } from "@/lib/onboarding-context";

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

const qaSchema = z.object({
  special: z.string().optional(),
  story: z.string().optional(),
  regulars: z.string().optional(),
  insider: z.string().optional(),
});

const riddleSchema = z.object({
  question: z.string(),
  answer_keywords: z.array(z.string()),
  hint_1: z.string(),
  hint_2: z.string(),
  difficulty: z.number().int().min(1).max(3),
});

const bodySchema = z.object({
  mode: z.enum(["pack", "one"]),
  place: placeSchema,
  qa: qaSchema.optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  existingRiddles: z.array(riddleSchema).optional(),
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
  const qa = (parsed.data.qa ?? {}) as OnboardingQa;
  const context = buildBarContextForClaude({ place, qa });

  try {
    if (parsed.data.mode === "pack") {
      const riddles = await generateOnboardingRiddlePack(context);
      return NextResponse.json({ riddles });
    }

    const d = parsed.data.difficulty;
    if (!d) {
      return NextResponse.json({ error: "Missing difficulty" }, { status: 400 });
    }
    const others = (parsed.data.existingRiddles ?? [])
      .filter((r) => r.difficulty !== d)
      .map((r) => `[${r.difficulty}] ${r.question}`)
      .join("\n");
    const riddle = await regenerateOnboardingRiddle({
      barContext: context,
      difficulty: d as 1 | 2 | 3,
      keepSummary: others || "(none yet)",
    });
    return NextResponse.json({ riddle });
  } catch (e) {
    console.error("[onboarding/generate-riddles]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 502 }
    );
  }
}
