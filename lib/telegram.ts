const API = "https://api.telegram.org";

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

export async function sendTelegramMessage(
  chatId: bigint | number,
  text: string,
  options?: { parse_mode?: "HTML" | "MarkdownV2" }
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  const body: Record<string, unknown> = {
    chat_id: Number(chatId),
    text,
    disable_web_page_preview: true,
  };
  if (options?.parse_mode) body.parse_mode = options.parse_mode;

  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram sendMessage failed", res.status, err);
    throw new Error(`Telegram API error: ${res.status}`);
  }
}

export function parseUpdate(body: unknown): TelegramUpdate | null {
  if (!body || typeof body !== "object") return null;
  return body as TelegramUpdate;
}

export function getTextMessage(update: TelegramUpdate): TelegramMessage | null {
  const m = update.message ?? update.edited_message;
  if (!m?.text) return null;
  return m;
}

export function isGroupChat(chat: TelegramChat): boolean {
  return chat.type === "group" || chat.type === "supergroup";
}

/** Private chat with the bot, or a group/supergroup (not channels). */
export function isHuntChatAllowed(chat: TelegramChat): boolean {
  return (
    chat.type === "private" ||
    chat.type === "group" ||
    chat.type === "supergroup"
  );
}
