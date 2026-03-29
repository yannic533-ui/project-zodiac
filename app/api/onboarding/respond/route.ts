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

  if (
    text.includes("tool") &&
    (text.includes("not supported") ||
      text.includes("unsupported") ||
      text.includes("not available") ||
      text.includes("invalid") ||
      text.includes("unknown tool") ||
      text.includes("disabled"))
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
  max_tokens: z.number().int().min(256).max(8192).optional(),
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

  const { messages, system, max_tokens } = parsed.data;
  const maxTokens = max_tokens ?? 4096;

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
    ...(system?.trim() ? { system: system.trim() } : {}),
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
