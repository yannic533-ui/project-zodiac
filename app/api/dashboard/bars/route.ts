import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  active: z.boolean().optional(),
  prize_description: z.string().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  active: z.boolean().optional(),
  prize_description: z.string().optional(),
});

export async function GET() {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  const { supabase, userId } = session;
  const { data, error } = await supabase
    .from("bars")
    .select("*")
    .eq("owner_id", userId)
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ bars: data ?? [] });
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
  const { data, error } = await supabase
    .from("bars")
    .insert({
      name: parsed.data.name,
      address: parsed.data.address,
      active: parsed.data.active ?? true,
      prize_description: parsed.data.prize_description ?? "",
      owner_id: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ bar: data });
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
  const { data, error } = await supabase
    .from("bars")
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
  return NextResponse.json({ bar: data });
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
    .from("bars")
    .delete()
    .eq("id", id)
    .eq("owner_id", userId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
