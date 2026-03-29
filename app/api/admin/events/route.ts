import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-admin";
import { activateEventExclusive, deactivateAllEvents } from "@/lib/events-admin";

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

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

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

  const sb = createAdminClient();

  let ownerId: string | null = null;
  const routeIds = parsed.data.route;
  if (routeIds.length > 0) {
    const { data: firstBar } = await sb
      .from("bars")
      .select("owner_id")
      .eq("id", routeIds[0])
      .maybeSingle();
    ownerId = (firstBar?.owner_id as string | null) ?? null;
  }

  if (parsed.data.active === true) {
    await deactivateAllEvents(sb);
  }

  const { data, error } = await sb
    .from("events")
    .insert({
      name: parsed.data.name,
      date: parsed.data.date ?? null,
      route: parsed.data.route,
      active: parsed.data.active ?? false,
      owner_id: ownerId,
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ event: data });
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

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

  const sb = createAdminClient();

  if (parsed.data.active === true) {
    await activateEventExclusive(sb, id);
    const { active: _setActive, ...rest } = parsed.data;
    void _setActive;
    if (Object.keys(rest).length === 0) {
      const { data, error } = await sb
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ event: data });
    }
    const { data, error } = await sb
      .from("events")
      .update(rest)
      .eq("id", id)
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

  const { data, error } = await sb
    .from("events")
    .update(parsed.data)
    .eq("id", id)
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
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
