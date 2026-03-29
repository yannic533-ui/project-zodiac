import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPrizeDescription, type OnboardingQa } from "@/lib/onboarding-context";
import type { PlaceDetailsResult } from "@/lib/google-places";

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

const riddleInSchema = z.object({
  question: z.string().min(1),
  answer_keywords: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(3),
  hint_1: z.string().optional(),
  hint_2: z.string().optional(),
});

const bodySchema = z.object({
  place: placeSchema,
  qa: qaSchema.optional(),
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  prize_description: z.string().optional(),
  riddles: z.array(riddleInSchema).min(1).max(20),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const place = parsed.data.place as PlaceDetailsResult;
  const qa = (parsed.data.qa ?? {}) as OnboardingQa;
  const name = parsed.data.name?.trim() || place.name;
  const address = parsed.data.address?.trim() || place.formatted_address;
  const prize =
    parsed.data.prize_description?.trim() ??
    buildPrizeDescription({ place, qa });

  const admin = createAdminClient();

  const { data: bar, error: barErr } = await admin
    .from("bars")
    .insert({
      name,
      address,
      active: true,
      prize_description: prize,
      owner_id: user.id,
    })
    .select("*")
    .single();

  if (barErr || !bar) {
    console.error(barErr);
    return NextResponse.json(
      { error: barErr?.message ?? "Failed to create bar" },
      { status: 500 }
    );
  }

  const barId = bar.id as string;
  const rows = parsed.data.riddles.map((r) => ({
    bar_id: barId,
    owner_id: user.id,
    question: r.question,
    answer_keywords: r.answer_keywords,
    difficulty: r.difficulty,
    hint_1: r.hint_1 ?? "",
    hint_2: r.hint_2 ?? "",
  }));

  const { error: rErr } = await admin.from("riddles").insert(rows);
  if (rErr) {
    console.error(rErr);
    await admin.from("bars").delete().eq("id", barId);
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  return NextResponse.json({ bar, ok: true });
}
