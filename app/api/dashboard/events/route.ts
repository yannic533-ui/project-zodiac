import { NextResponse } from "next/server";
import { z } from "zod";
import { activateEventExclusive } from "@/lib/events-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSessionUser } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  date: z.union([z.string(), z.null()]).optional(),
  route: z.array(z.string().uuid()).default([]),
  active: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.union([z.string(), z.null()]).optional(),
  route: z.array(z.string().uuid()).optional(),
  active: z.boolean().optional(),
});

async function assertBarsOwned(
  supabase: ReturnType<
    typeof import("@/lib/supabase/server").createSupabaseServerClient
  >,
  userId: string,
  barIds: string[]
): Promise<boolean> {
  if (barIds.length === 0) return true;
  const { data } = await supabase
    .from("bars")
    .select("id")
    .in("id", barIds)
    .eq("owner_id", userId);
  return (data?.length ?? 0) === barIds.length;
}

export async function GET() {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  const { supabase, userId } = session;
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { supabase, userId } = session;
  const routeIds = [...new Set(parsed.data.route)];
  const okBars = await assertBarsOwned(supabase, userId, routeIds);
  if (!okBars) {
    return NextResponse.json(
      { error: "Route may only include your bars" },
      { status: 400 }
    );
  }

  const wantActive = parsed.data.active === true;
  const { data, error } = await supabase
    .from("events")
    .insert({
      name: parsed.data.name,
      date: parsed.data.date ?? null,
      route: routeIds,
      active: false,
      owner_id: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (wantActive) {
    const admin = createAdminClient();
    await activateEventExclusive(admin, data.id as string);
    const { data: refreshed } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return NextResponse.json({ event: refreshed ?? { ...data, active: true } });
  }

  return NextResponse.json({ event: data });
}

export async function PATCH(request: Request) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { supabase, userId } = session;

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (evErr || !ev || ev.owner_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.route) {
    const routeIds = [...new Set(parsed.data.route)];
    const okBars = await assertBarsOwned(supabase, userId, routeIds);
    if (!okBars) {
      return NextResponse.json(
        { error: "Route may only include your bars" },
        { status: 400 }
      );
    }
  }

  if (parsed.data.active === true) {
    const admin = createAdminClient();
    await activateEventExclusive(admin, id);
    const { active: _a, ...rest } = parsed.data;
    void _a;
    if (Object.keys(rest).length === 0) {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ event: data });
    }
    const { data, error } = await supabase
      .from("events")
      .update(rest)
      .eq("id", id)
      .eq("owner_id", userId)
      .select("*")
      .maybeSingle();
    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ event: data });
  }

  const { data, error } = await supabase
    .from("events")
    .update(parsed.data)
    .eq("id", id)
    .eq("owner_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ event: data });
}

export async function DELETE(request: Request) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { supabase, userId } = session;
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
