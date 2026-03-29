import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/require-session";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  telegram_chat_id: z.string().regex(/^-?\d+$/),
  text: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

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

  const { supabase, userId } = session;

  const { data: myEvents } = await supabase
    .from("events")
    .select("id")
    .eq("owner_id", userId);
  const eventIds = (myEvents ?? []).map((e) => e.id as string);
  if (eventIds.length === 0) {
    return NextResponse.json({ error: "No events" }, { status: 400 });
  }

  const chatId = Number(parsed.data.telegram_chat_id);
  const { data: group } = await supabase
    .from("groups")
    .select("id, event_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (!group || !eventIds.includes(group.event_id as string)) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
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
