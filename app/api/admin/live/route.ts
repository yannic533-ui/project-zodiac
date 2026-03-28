import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-admin";
import { filterActiveRoute } from "@/lib/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const sb = createAdminClient();

  const { data: groups, error: gErr } = await sb
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (gErr) {
    console.error(gErr);
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  const { data: events, error: eErr } = await sb.from("events").select("id, name, route");
  if (eErr) {
    console.error(eErr);
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  const { data: bars, error: bErr } = await sb.from("bars").select("id, name, active");
  if (bErr) {
    console.error(bErr);
    return NextResponse.json({ error: bErr.message }, { status: 500 });
  }

  const eventMap = new Map((events ?? []).map((e) => [e.id as string, e]));
  const barById = new Map(
    (bars ?? []).map((b) => [
      b.id as string,
      { name: b.name as string, active: b.active as boolean },
    ])
  );
  const activeIds = new Set(
    (bars ?? []).filter((b) => b.active).map((b) => b.id as string)
  );

  const rows = (groups ?? []).map((g) => {
    const ev = eventMap.get(g.event_id as string);
    const route = (ev?.route as string[] | undefined) ?? [];
    const filtered = filterActiveRoute(route, activeIds);
    const idx = Number(g.current_bar_index);
    const barId = filtered[idx];
    const barMeta = barId ? barById.get(barId) : undefined;
    return {
      id: g.id,
      event_id: g.event_id,
      event_name: ev?.name ?? null,
      telegram_chat_id: String(g.telegram_chat_id),
      group_name: g.group_name,
      state: g.state,
      current_bar_index: idx,
      current_bar_name: barMeta?.name ?? null,
      points: g.points,
      language: g.language,
      hints_delivered: g.hints_delivered,
      hint_count: g.hint_count,
    };
  });

  return NextResponse.json({ groups: rows });
}
