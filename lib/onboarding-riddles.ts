import Anthropic, { APIError } from "@anthropic-ai/sdk";
import {
  anthropicWebSearchToolsParam,
  concatAssistantText,
} from "@/lib/anthropic-web-search";

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

export type OnboardingRiddleDraft = {
  question: string;
  answer_keywords: string[];
  hint_1: string;
  hint_2: string;
  difficulty: 1 | 2 | 3;
};

const SYSTEM = `You help bar owners create navigation riddles for a real-world scavenger hunt.
Return ONLY valid JSON, no markdown fences.

Generate all riddles in German. Always. If the owner's notes explicitly ask for another language, follow that exception only for that request.

CORE CONCEPT — players are NOT at the bar yet. They start somewhere else. Each riddle must LEAD them TO the venue using clues they can follow while walking or on a map. When they arrive and say the passphrase to the bartender, they get the next clue.

WRONG: riddles that assume the player is already inside or already knows which bar it is (e.g. interior-only trivia, "what do you see at the bar", details only noticeable after entry).

RIGHT: clues about LOCATION (street, neighbourhood, district, building, local history), clues about WHAT the place is without naming it, enough that someone can decide where to go next (e.g. "I need to head to Brauerstrasse 36").

The riddle must NEVER reveal or assume:
- The bar's proper name (in question, hints, or answer_keywords)
- The exact full address dumped plainly in one sentence (indirect hints are OK: e.g. street theme + house number, district + number range)
- Anything that only makes sense if you are already there

The riddle MUST include:
- Enough information to physically navigate toward the location
- A street or neighbourhood reference (direct or indirect)
- Something distinctive about the place (type, reputation, sound system, history of the area) so players can confirm they chose the right spot — without naming the venue

Examples of CORRECT style (adapt facts from context only; do not copy if they do not match the real venue):
EASY: "Diese Strasse trägt den Namen eines alten Handwerks. Geh zu Nummer 36 und klopf an."
MEDIUM: "Im Kreis 4, wo früher Bier gebraut wurde, steht eine Bar die für ihre Soundanlage bekannt ist. Die Hausnummer ist eine gerade Zahl — die kleinste zwischen 35 und 40."
HARD: "1900 roch diese Strasse nach Hopfen und Malz. Heute riecht sie nach Cocktails. Finde die Bar mit dem Klipsch-Sound im ehemaligen Industriequartier."

ANTI-HALLUCINATION (riddles):
Only use facts explicitly provided by the bar owner or found via web search in your tool results. Do not invent any details (years, owners, events, brands, history).
If a fact is uncertain or not in context, make the riddle more general (reference street/neighbourhood/district) instead of specific unverified claims.

Tone: grounded, clever, not corny. Hints nudge toward the route, not toward "you are already inside".
answer_keywords: 3–8 short phrases or words that count as correct for WHERE to go (street, area, number, landmark — synonyms OK). Never put the bar's trade name as a keyword.`;

function normalizeRiddle(
  raw: Record<string, unknown>,
  difficulty: 1 | 2 | 3
): OnboardingRiddleDraft | null {
  const question =
    typeof raw.question === "string" && raw.question.trim()
      ? raw.question.trim()
      : null;
  if (!question) return null;
  const kwRaw = raw.answer_keywords;
  const answer_keywords = Array.isArray(kwRaw)
    ? kwRaw
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  const hint_1 =
    typeof raw.hint_1 === "string" ? raw.hint_1.trim() : "";
  const hint_2 =
    typeof raw.hint_2 === "string" ? raw.hint_2.trim() : "";
  return {
    question,
    answer_keywords,
    hint_1,
    hint_2,
    difficulty,
  };
}

export async function generateOnboardingRiddlePack(
  barContext: string
): Promise<OnboardingRiddleDraft[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const client = new Anthropic({
    apiKey: key,
    timeout: anthropicTimeoutMs(),
    maxRetries: 1,
  });

  const user = `Bar context (facts + owner notes):\n${barContext}\n\nCreate exactly 3 riddles: difficulty 1 = easy, 2 = medium, 3 = hard.
Each riddle must be distinct and about this specific bar or what you would notice there.
Write everything in German unless the owner notes explicitly request another language.

Return ONLY this JSON shape:
{"riddles":[
  {"question":"...","answer_keywords":["..."],"hint_1":"...","hint_2":"...","difficulty":1},
  {"question":"...","answer_keywords":["..."],"hint_1":"...","hint_2":"...","difficulty":2},
  {"question":"...","answer_keywords":["..."],"hint_1":"...","hint_2":"...","difficulty":3}
]}`;

  let res;
  try {
    res = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 1_200,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
      tools: anthropicWebSearchToolsParam() as never,
    });
  } catch (e) {
    if (e instanceof APIError) {
      console.error("[onboarding-riddles]", e.message);
    }
    throw e;
  }

  const combined = concatAssistantText(res.content).trim();
  if (!combined) {
    throw new Error("No text in model response");
  }

  const parsed = extractJsonObject(combined);
  const arr = parsed?.riddles;
  if (!Array.isArray(arr) || arr.length < 3) {
    throw new Error("Invalid riddles JSON");
  }

  const out: OnboardingRiddleDraft[] = [];
  for (let i = 0; i < 3; i++) {
    const d = (i + 1) as 1 | 2 | 3;
    const r = normalizeRiddle(arr[i] as Record<string, unknown>, d);
    if (!r) throw new Error(`Invalid riddle at index ${i}`);
    out.push(r);
  }
  return out;
}

export async function regenerateOnboardingRiddle(params: {
  barContext: string;
  difficulty: 1 | 2 | 3;
  keepSummary: string;
}): Promise<OnboardingRiddleDraft> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const client = new Anthropic({
    apiKey: key,
    timeout: anthropicTimeoutMs(),
    maxRetries: 1,
  });

  const user = `Bar context:\n${params.barContext}\n\nOther riddles already approved (do not copy):\n${params.keepSummary}\n\nRegenerate ONLY the riddle with difficulty ${params.difficulty} (${params.difficulty === 1 ? "easy" : params.difficulty === 2 ? "medium" : "hard"}).
The riddle must LEAD players TO the bar from elsewhere (navigation clues), never assume they are already inside. Never use the bar's proper name.
Only use facts from owner notes or verified web search; if unsure, use general street/neighbourhood clues.
Output in German unless the owner notes explicitly request another language.

Return ONLY this JSON shape:
{"question":"...","answer_keywords":["..."],"hint_1":"...","hint_2":"...","difficulty":${params.difficulty}}`;

  const res = await client.messages.create({
    model: anthropicModel(),
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
    tools: anthropicWebSearchToolsParam() as never,
  });

  const combined = concatAssistantText(res.content).trim();
  if (!combined) {
    throw new Error("No text in model response");
  }

  const parsed = extractJsonObject(combined);
  if (!parsed) throw new Error("Invalid JSON");
  const r = normalizeRiddle(parsed, params.difficulty);
  if (!r) throw new Error("Invalid riddle");
  return r;
}
