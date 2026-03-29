import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type { PlaceDetailsResult } from "@/lib/google-places";
import type { OnboardingQaKey } from "@/lib/i18n/translations";

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

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest";
}

function anthropicTimeoutMs(): number {
  const n = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25_000;
}

function extractJsonArray(text: string): unknown[] | null {
  const t = text.trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeThreeSuggestions(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= 3) break;
  }
  return out;
}

function chipsFromSuggestions(
  suggestions: string[]
): Record<OnboardingQaKey, string[]> {
  return {
    special: suggestions,
    story: [],
    regulars: [],
    insider: [],
  };
}

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

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  const langWord = languageCode === "de" ? "German" : "English";

  const user = `You are generating conversation suggestions for a bar owner onboarding their venue onto a Zurich scavenger hunt platform.

Bar details:
${JSON.stringify(place, null, 2)}

Generate exactly 3 short suggestions in ${langWord}.
Each suggestion is something the bar owner might say about their bar —
a specific detail, story, or insider fact that Claude could NOT know from Google alone.

Rules:
- Maximum 12 words each
- Specific to this exact bar and location
- Sound like something a real bar owner would say
- No generic statements like 'we have great cocktails'
- Reference the street, neighbourhood, history, or specific details
- Return ONLY a JSON array of 3 strings, nothing else

Example for a bar on Langstrasse:
["Früher war hier eine Tanzschule, die Böden sind original",
 "Unsere Fensterplätze gehen auf den Langstrassenmarkt",
 "Der Barkeeper hier seit 15 Jahren kennt jeden Stammgast"]`;

  const client = new Anthropic({
    apiKey: key,
    timeout: anthropicTimeoutMs(),
    maxRetries: 1,
  });

  try {
    const res = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 800,
      system:
        "You output ONLY a JSON array of exactly 3 strings. No markdown fences, no commentary.",
      messages: [{ role: "user", content: user }],
    });

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "No text in model response" },
        { status: 502 }
      );
    }

    const arr = extractJsonArray(block.text);
    if (!arr) {
      return NextResponse.json(
        { error: "Model JSON parse failed" },
        { status: 502 }
      );
    }

    const three = normalizeThreeSuggestions(arr);
    if (three.length === 0) {
      return NextResponse.json(
        { error: "Model returned no valid suggestions" },
        { status: 502 }
      );
    }

    const chips = chipsFromSuggestions(three);
    return NextResponse.json({ chips });
  } catch (e) {
    if (e instanceof APIError) {
      console.error("[onboarding/suggestions]", e.message, e.status);
    } else {
      console.error("[onboarding/suggestions]", e);
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Suggestions failed" },
      { status: 502 }
    );
  }
}
