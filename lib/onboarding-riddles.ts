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

CRITICAL — RIDDLE STRUCTURE:
Each riddle must lead players TO this bar without naming it.
Players start somewhere else and must figure out the address from clues.

Every riddle MUST contain:
- A clue about the STREET or NEIGHBOURHOOD (indirect is fine)
- A clue about what makes this place findable once they are in the right area
- Enough information to physically navigate there
- NEVER mention the bar name
- NEVER use information that only makes sense once you're already inside

Formula for each riddle:
[Historical or geographical clue about the location] +
[Specific detail that confirms arrival] +
[Question or instruction to go there]

Example for Stereo, Brauerstrasse 36, Kreis 4 (style only — adapt to the real venue from context; do not copy unrelated facts):

LEICHT: "Im Kreis 4 gibt es eine Strasse die nach einem alten Handwerk benannt ist. Geh zur geraden Hausnummer zwischen 35 und 40. Was erwartet dich dort?"

MITTEL: "1900 roch diese Strasse nach Hopfen und Malz. Heute klingt sie nach Musik. Die Hausnummer ist die kleinste gerade Zahl über 34."

SCHWER: "Diese Strasse im Kreis 4 trug einst das Handwerk in ihrem Namen, das ganz Zürich mit Bier versorgte. Hausnummer = (Gründungsjahr der Stadt Zürich im Jahr 853) minus 817. Was findest du dort?"

BAD examples (never do this):
- "Welcher Tag ist das Stereo geschlossen?" (assumes you're there)
- "Was macht die Soundanlage des Stereo besonders?" (names bar)
- "Wie viele Barhocker hat das Stereo?" (requires being inside)

ANTI-HALLUCINATION (riddles):
Only use facts from the owner's notes or from web search tool results. Do not invent years, events, or claims. If unsure, use vaguer navigation clues (street/neighbourhood only).

answer_keywords: 3–8 short phrases for WHERE to go (street, area, number — synonyms OK). Never the venue's trade name.`;

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

  const user = `Bar context (facts + owner notes):\n${barContext}\n\nCreate exactly 3 riddles: difficulty 1 = easy (LEICHT), 2 = medium (MITTEL), 3 = hard (SCHWER).
Each riddle is a NAVIGATION CLUE: players solve it, then know which address to go to — they are not at the bar yet. Follow CRITICAL — RIDDLE STRUCTURE and the formula in the system prompt.
Use web search when needed; only embed verifiable facts. Write in German unless owner notes request another language.

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

  const user = `Bar context:\n${params.barContext}\n\nOther riddles already approved (do not copy):\n${params.keepSummary}\n\nRegenerate ONLY the riddle with difficulty ${params.difficulty} (${params.difficulty === 1 ? "LEICHT" : params.difficulty === 2 ? "MITTEL" : "SCHWER"}).
Must follow CRITICAL — RIDDLE STRUCTURE: lead players TO the bar from elsewhere; never inside-only or bar-name trivia. Never use the bar's proper name.
Facts only from owner notes or web search; if unsure, vaguer street/neighbourhood clues.
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
