import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type { GroupLanguage } from "@/lib/types";

/** Override if Anthropic retires a snapshot; `*-latest` tracks current Haiku. */
function anthropicModel(): string {
  return (
    process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest"
  );
}

function anthropicTimeoutMs(): number {
  const n = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25_000;
}

function logClaudeError(prefix: string, err: unknown): void {
  if (err instanceof APIError) {
    console.error(prefix, {
      name: err.name,
      message: err.message,
      status: err.status,
      requestId: err.request_id,
    });
    return;
  }
  if (err instanceof Error) {
    console.error(prefix, { name: err.name, message: err.message });
    return;
  }
  console.error(prefix, String(err));
}

const DER_BOTE_SYSTEM = `You are "Der Bote" — an anonymous urban legend of Zurich. 
You have walked every street, sat in every bar, know every story this city holds.
You want to share it. Not as a guide — as a co-conspirator.

Rules:
- Never reveal you are AI or a bot
- Ask the group at the start: "English or Deutsch?" — then stick to that language for the entire conversation
- Never mix languages, never use Swiss German in writing
- Tone: cool, warm, like a friend who knows the city better than anyone
- Never be corny, never be theatrical, never over-explain
- Short messages. Always. Max 3 sentences.
- Validate answers generously — spelling variations, partial answers, close enough counts
- Passphrases feel like something you'd whisper at a bar, not recite
  (e.g. "Das Licht brennt noch" / "The light is still on")
- When a group is stuck: tease, don't lecture. One small nudge, not a hint list.
- Celebrate arrivals briefly — then move on. No emojis, no exclamation marks.
- You know Zurich's history, its hidden corners, its contradictions. Let that show naturally.

When asked to return JSON, output ONLY valid JSON, no markdown fences, with the exact keys requested.`;

export type RiddleValidationResult = {
  valid: boolean;
  passphrase: string | null;
  reply: string;
};

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

export async function validateRiddleWithClaude(params: {
  language: GroupLanguage;
  question: string;
  answerKeywords: string[];
  userAnswer: string;
}): Promise<RiddleValidationResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("[claude] Missing ANTHROPIC_API_KEY");
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const model = anthropicModel();
  const client = new Anthropic({
    apiKey: key,
    timeout: anthropicTimeoutMs(),
    maxRetries: 1,
  });
  const lang = params.language === "de" ? "German" : "English";

  console.log("[claude] validateRiddle start", {
    model,
    language: params.language,
    questionLen: params.question.length,
    answerLen: params.userAnswer.length,
  });

  const user = `Language for all user-facing text: ${lang}.

Riddle question: ${params.question}
Keywords the organizers consider valid (guidance, not exhaustive): ${params.answerKeywords.join(", ") || "(none)"}
Group's answer: ${params.userAnswer}

Decide if the answer is correct or close enough (typos, synonyms, partial match OK).

Return ONLY this JSON shape:
{"valid":true or false,"passphrase":"short whisper phrase in ${lang} if valid, else null","reply":"max 3 sentences in ${lang}, Der Bote voice — if valid: brief nod then give passphrase in JSON only; if wrong: one teasing nudge, no solution"}`;

  let res;
  try {
    res = await client.messages.create({
      model,
      max_tokens: 400,
      system: DER_BOTE_SYSTEM,
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    logClaudeError("[claude] messages.create failed", e);
    throw e;
  }

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    console.warn("[claude] No text block in response", {
      blockTypes: res.content.map((b) => b.type),
    });
    return {
      valid: false,
      passphrase: null,
      reply:
        params.language === "de"
          ? "Noch einmal. Du bist nah dran."
          : "Again. You are closer than you think.",
    };
  }

  const parsed = extractJsonObject(block.text);
  if (!parsed) {
    console.warn("[claude] JSON parse failed, using raw text snippet", {
      snippet: block.text.slice(0, 120),
    });
    return {
      valid: false,
      passphrase: null,
      reply: block.text.slice(0, 500),
    };
  }

  const valid = Boolean(parsed.valid);
  const passphrase =
    typeof parsed.passphrase === "string" && parsed.passphrase.trim()
      ? String(parsed.passphrase).trim()
      : null;
  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim()
      ? String(parsed.reply).trim()
      : params.language === "de"
        ? "Weiter."
        : "Keep going.";

  if (valid && !passphrase) {
    return {
      valid: false,
      passphrase: null,
      reply:
        params.language === "de"
          ? "Sagen wir, fast. Formuliere es noch einmal."
          : "Almost. Say it once more, cleaner.",
    };
  }

  const out = { valid, passphrase: valid ? passphrase : null, reply };
  console.log("[claude] validateRiddle done", {
    valid: out.valid,
    hasPassphrase: Boolean(out.passphrase),
  });
  return out;
}
