import { NextResponse } from "next/server";
import { processHuntMessage } from "@/lib/hunt-logic";
import { getTextMessage, isHuntChatAllowed, parseUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const token = request.headers.get("x-telegram-bot-api-secret-token");
    if (token !== secret) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const update = parseUpdate(body);
  if (!update) return NextResponse.json({ ok: true });

  const msg = getTextMessage(update);
  if (!msg) return NextResponse.json({ ok: true });

  if (msg.from?.is_bot) return NextResponse.json({ ok: true });

  if (!isHuntChatAllowed(msg.chat)) return NextResponse.json({ ok: true });

  try {
    await processHuntMessage(msg);
  } catch (e) {
    console.error("webhook process error", e);
  }

  return NextResponse.json({ ok: true });
}
