import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BarRow = {
  id: string;
  name: string;
  owner_id: string | null;
  active: boolean;
};

type EventRow = {
  id: string;
  name: string;
  owner_id: string | null;
  active: boolean;
};

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const sb = createAdminClient();

  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id, role")
    .eq("role", "bar_owner");

  if (pErr) {
    console.error(pErr);
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const ownerIds = (profiles ?? []).map((p) => p.id as string);

  const { data: bars } = await sb.from("bars").select("id, name, owner_id, active");
  const { data: events } = await sb.from("events").select("id, name, owner_id, active");

  const barsByOwner = new Map<string, BarRow[]>();
  for (const b of (bars ?? []) as BarRow[]) {
    const oid = b.owner_id;
    if (!oid) continue;
    const list = barsByOwner.get(oid) ?? [];
    list.push(b);
    barsByOwner.set(oid, list);
  }

  const eventsByOwner = new Map<string, EventRow[]>();
  for (const e of (events ?? []) as EventRow[]) {
    const oid = e.owner_id;
    if (!oid) continue;
    const list = eventsByOwner.get(oid) ?? [];
    list.push(e);
    eventsByOwner.set(oid, list);
  }

  const emailById = new Map<string, string>();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data: pageData, error: uErr } = await sb.auth.admin.listUsers({
      page,
      perPage,
    });
    if (uErr) {
      console.error(uErr);
      break;
    }
    const batch = pageData?.users ?? [];
    for (const u of batch) {
      if (u.email) emailById.set(u.id, u.email);
    }
    if (batch.length < perPage) break;
    page += 1;
  }

  const owners = ownerIds.map((id) => ({
    id,
    email: emailById.get(id) ?? null,
    bars: barsByOwner.get(id) ?? [],
    events: eventsByOwner.get(id) ?? [],
  }));

  return NextResponse.json({ owners });
}
