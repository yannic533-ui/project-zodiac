import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  const { supabase, userId } = session;

  const { count: barCount, error: bErr } = await supabase
    .from("bars")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (bErr) {
    console.error(bErr);
    return NextResponse.json({ error: bErr.message }, { status: 500 });
  }

  const { data: events, error: eErr } = await supabase
    .from("events")
    .select("id, name, active")
    .eq("owner_id", userId);

  if (eErr) {
    console.error(eErr);
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  const activeEvent = (events ?? []).find((e) => e.active);
  let livePlayerCount = 0;
  if (activeEvent) {
    const { count, error: gErr } = await supabase
      .from("groups")
      .select("id", { count: "exact", head: true })
      .eq("event_id", activeEvent.id as string);
    if (!gErr) livePlayerCount = count ?? 0;
  }

  return NextResponse.json({
    barCount: barCount ?? 0,
    events: events ?? [],
    activeEvent: activeEvent ?? null,
    livePlayerCount,
  });
}
