import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-admin";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  telegram_chat_id: z.string().regex(/^-?\d+$/),
  text: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

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

  try {
    await sendTelegramMessage(BigInt(parsed.data.telegram_chat_id), parsed.data.text);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to send Telegram message" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
