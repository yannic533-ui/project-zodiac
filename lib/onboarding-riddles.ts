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

const SYSTEM = `You help bar owners create short riddles for a real-world scavenger hunt.
Players visit the bar in person; riddles must be solvable on site (no obscure trivia).
Return ONLY valid JSON, no markdown fences.

Tone: grounded, clever, not corny. Hints nudge without giving away the answer.
answer_keywords: 3–8 short phrases or words that count as correct (synonyms OK).`;

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
