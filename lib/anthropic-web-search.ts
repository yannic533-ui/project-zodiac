import type { Message } from "@anthropic-ai/sdk/resources/messages";

/**
 * Server-side web search (Anthropic executes searches).
 * Cast at call site: SDK types may not include `web_search_20250305` yet.
 */
export function anthropicWebSearchToolsParam(): unknown[] {
  return [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5,
    },
  ];
}

/** Concatenate all plain text segments (web search turns may include multiple text blocks). */
export function concatAssistantText(content: Message["content"]): string {
  let s = "";
  for (const block of content) {
    if (block.type === "text") s += block.text;
  }
  return s;
}
