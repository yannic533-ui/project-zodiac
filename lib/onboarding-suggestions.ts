import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type { PlaceDetailsResult } from "@/lib/google-places";
import type { OnboardingQaKey } from "@/lib/i18n/translations";

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest";
}

function anthropicTimeoutMs(): number {
  const n = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25_000;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const KEYS: OnboardingQaKey[] = ["special", "story", "regulars", "insider"];

function normalizeChips(raw: unknown, max = 6): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const s = x.trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Short, venue-specific answer chips for onboarding Q&A (one Claude call).
 */
export async function generateOnboardingChipSuggestions(params: {
  place: PlaceDetailsResult;
  language: "de" | "en";
}): Promise<Record<OnboardingQaKey, string[]>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const p = params.place;
  const lang = params.language === "de" ? "German" : "English";
  const lines = [
    `Venue name: ${p.name}`,
    `Address: ${p.formatted_address}`,
    p.website ? `Website: ${p.website}` : null,
    p.editorial_summary?.overview
      ? `Description / Google summary: ${p.editorial_summary.overview}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({
    apiKey: key,
    timeout: anthropicTimeoutMs(),
    maxRetries: 1,
  });

  const user = `You suggest short "chip" phrases bar owners can tap to pre-fill onboarding answers for THEIR venue only.

Context:
${lines}

Questions (each needs its own chips):
- special: What makes this bar special (music, atmosphere, signature drink, layout, history hook).
- story: Name or location backstory, building history, neighborhood angle.
- regulars: What regulars order, rituals, staff quirks, unwritten rules.
- insider: Concrete insider tips (where to sit, timing, door policy, hidden room) — plausible for this venue.

Rules:
- All chip text in ${lang} only.
- Each chip max ~80 characters, no quotes inside strings, no numbering.
- Be specific to THIS venue; if info is thin, infer plausible Zurich/nightlife-typical details that still fit the name and address — never generic filler like "nice atmosphere".
- Return ONLY valid JSON, no markdown, with exactly these keys: special, story, regulars, insider. Each value is an array of 4–6 strings.`;

  let res;
  try {
    res = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 1200,
      system:
        "You output ONLY compact JSON objects. No markdown fences, no commentary.",
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    if (e instanceof APIError) {
      console.error("[onboarding-suggestions]", e.message, e.status);
    }
    throw e;
  }

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text in model response");
  }

  const parsed = extractJsonObject(block.text);
  if (!parsed) {
    throw new Error("Model JSON parse failed");
  }

  const out = {} as Record<OnboardingQaKey, string[]>;
  for (const k of KEYS) {
    out[k] = normalizeChips(parsed[k]);
  }
  return out;
}
