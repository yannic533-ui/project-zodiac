import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const eventId = new URL(request.url).searchParams.get("event_id");
  if (!eventId) {
    return NextResponse.json({ error: "Missing event_id" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: passes, error } = await sb
    .from("passphrases")
    .select("id, code, generated_at, bar_id")
    .eq("event_id", eventId)
    .order("generated_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = passes ?? [];
  const barIds = Array.from(
    new Set(list.map((p) => p.bar_id as string))
  );
  const barNameById = new Map<string, string>();
  if (barIds.length > 0) {
    const { data: bars, error: bErr } = await sb
      .from("bars")
      .select("id, name")
      .in("id", barIds);
    if (!bErr && bars) {
      for (const b of bars) {
        barNameById.set(b.id as string, b.name as string);
      }
    }
  }

  const rows = list.map((row) => ({
    id: row.id,
    code: row.code,
    generated_at: row.generated_at,
    bar_id: row.bar_id,
    bar_name: barNameById.get(row.bar_id as string) ?? null,
  }));

  return NextResponse.json({ passphrases: rows });
}
