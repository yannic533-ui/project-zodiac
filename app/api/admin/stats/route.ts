import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const sb = createAdminClient();
  const [bars, events, groups] = await Promise.all([
    sb.from("bars").select("id", { count: "exact", head: true }),
    sb.from("events").select("id", { count: "exact", head: true }),
    sb.from("groups").select("id", { count: "exact", head: true }),
  ]);

  if (bars.error) {
    return NextResponse.json({ error: bars.error.message }, { status: 500 });
  }
  if (events.error) {
    return NextResponse.json({ error: events.error.message }, { status: 500 });
  }
  if (groups.error) {
    return NextResponse.json({ error: groups.error.message }, { status: 500 });
  }

  return NextResponse.json({
    totalBars: bars.count ?? 0,
    totalEvents: events.count ?? 0,
    totalGroupsPlayed: groups.count ?? 0,
  });
}
