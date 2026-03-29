import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import {
  anthropicWebSearchToolsParam,
  concatAssistantText,
} from "@/lib/anthropic-web-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Web search requires Sonnet 4.5+; keep fixed for this route. */
const ONBOARDING_RESPOND_MODEL = "claude-sonnet-4-5";

/** Short replies; strict prompt caps length — keep generation small. */
const DEFAULT_MAX_TOKENS = 512;

function strictOnboardingSystem(locale: "de" | "en"): string {
  const lang = locale === "de" ? "German" : "English";
  return `You are a minimal, warm assistant helping a bar owner add their venue
to a scavenger hunt platform.

STRICT RULES — no exceptions:
- Maximum 2 sentences per response. Never more.
- No emojis. Ever.
- No exclamation marks. Ever.
- No words: perfekt, super, toll, fantastisch, wunderbar, freue, great, perfect, wonderful
- No filler phrases like "Hier ist meine..." or "Ich sehe dass..."
- Respond in ${lang} only

ANTI-HALLUCINATION — STRICT:
You have web search available. USE IT before stating any fact.
If you cannot verify a fact via web search, do NOT state it.
If you find nothing online, say: "Ich finde wenig online dazu." (German) or the same meaning in English if replying in English.
Then ask the owner directly.

Never invent:
- Opening year or founding date
- Owner names
- Specific events or history
- Awards or recognition
- Any numbers or dates

Only state facts you found via web search with high confidence.
For borderline claims in German you may prefix "Ich glaube..."; in English "I think..." — or omit.

For confirm phase — only verified search facts, max 2 sentences, or say you found little and ask the owner:
Good: "Online steht die Adresse in Kreis 4 und Cocktails — passt das. Was sollen wir noch wissen?"
Good: "Ich finde wenig Verifiziertes. Was fällt Gästen von aussen auf?"
Bad: "Perfekt! Ich freue mich, dass ihr dabei seid!"

For qa phase — react to what user said; if you suggest a riddle snippet, it must LEAD players TO the bar (street, neighbourhood, how to find it), not inside-only trivia. Ask one question:
Good: "Handwerks-Strasse und eine Hausnummer — brauchbar fürs Rätsel. Noch ein Merkmal?"
Bad: "Was siehst du an der Theke, wenn du schon da bist?"

Never write more than 2 sentences. Cut everything else.`;
}

function anthropicTimeoutMs(): number {
  const n = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

function safeStringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Detect API failures tied to web search / server tools so we can retry without tools.
 */
function isWebSearchRelatedApiError(err: unknown): boolean {
  if (!(err instanceof APIError)) return false;
  const text = [err.message, safeStringify(err.error)]
    .join(" ")
    .toLowerCase();

  if (
    text.includes("web_search") ||
    text.includes("web search") ||
    text.includes("websearch")
  ) {
    return true;
  }

  if (
    text.includes("server_tool") ||
    text.includes("server tool") ||
    text.includes("server-side tool")
  ) {
    return true;
  }

  return false;
}

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
  system: z.string().optional(),
  locale: z.enum(["de", "en"]).optional(),
  max_tokens: z.number().int().min(64).max(8192).optional(),
});

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
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

  const { messages, system, max_tokens, locale: bodyLocale } = parsed.data;
  const maxTokens = max_tokens ?? DEFAULT_MAX_TOKENS;
  const locale: "de" | "en" = bodyLocale === "en" ? "en" : "de";
  const strict = strictOnboardingSystem(locale);
  const tail = system?.trim();
  const mergedSystem = tail ? `${strict}\n\n---\n\n${tail}` : strict;

  const client = new Anthropic({
    apiKey: key,
    timeout: anthropicTimeoutMs(),
    maxRetries: 0,
  });

  const apiMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const baseParams = {
    model: ONBOARDING_RESPOND_MODEL,
    max_tokens: maxTokens,
    messages: apiMessages,
    system: mergedSystem,
  };

  let usedWebSearch = false;

  try {
    let res;
    try {
      res = await client.messages.create({
        ...baseParams,
        tools: anthropicWebSearchToolsParam() as never,
      });
      usedWebSearch = true;
    } catch (first: unknown) {
      if (!isWebSearchRelatedApiError(first)) {
        throw first;
      }
      console.warn(
        "[onboarding/respond] web search failed, retrying without tools:",
        first instanceof APIError ? first.message : first
      );
      res = await client.messages.create(baseParams);
    }

    const text = concatAssistantText(res.content).trim();
    if (!text) {
      return NextResponse.json(
        { error: "No text in model response" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      text,
      model: ONBOARDING_RESPOND_MODEL,
      usedWebSearch,
    });
  } catch (e) {
    if (e instanceof APIError) {
      console.error("[onboarding/respond]", e.message, e.status);
    } else {
      console.error("[onboarding/respond]", e);
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Respond failed" },
      { status: 502 }
    );
  }
}
