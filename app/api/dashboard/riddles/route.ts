import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser } from "@/lib/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  bar_id: z.string().uuid(),
  question: z.string().min(1),
  answer_keywords: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(3),
  hint_1: z.string().optional(),
  hint_2: z.string().optional(),
});

const patchSchema = z.object({
  question: z.string().min(1).optional(),
  answer_keywords: z.array(z.string()).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  hint_1: z.string().optional(),
  hint_2: z.string().optional(),
  bar_id: z.string().uuid().optional(),
});

async function assertBarOwned(
  supabase: ReturnType<
    typeof import("@/lib/supabase/server").createSupabaseServerClient
  >,
  userId: string,
  barId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("bars")
    .select("id")
    .eq("id", barId)
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  const barId = new URL(request.url).searchParams.get("bar_id");
  const { supabase, userId } = session;

  let barIds: string[] | null = null;
  if (barId) {
    const ok = await assertBarOwned(supabase, userId, barId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    barIds = [barId];
  } else {
    const { data: bars } = await supabase
      .from("bars")
      .select("id")
      .eq("owner_id", userId);
    barIds = (bars ?? []).map((b) => b.id as string);
    if (barIds.length === 0) {
      return NextResponse.json({ riddles: [] });
    }
  }

  let q = supabase.from("riddles").select("*").order("difficulty", { ascending: true });
  if (barIds.length === 1) {
    q = q.eq("bar_id", barIds[0]);
  } else {
    q = q.in("bar_id", barIds);
  }

  const { data, error } = await q;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ riddles: data ?? [] });
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
  const owned = await assertBarOwned(supabase, userId, parsed.data.bar_id);
  if (!owned) {
    return NextResponse.json({ error: "Invalid bar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("riddles")
    .insert({
      bar_id: parsed.data.bar_id,
      owner_id: userId,
      question: parsed.data.question,
      answer_keywords: parsed.data.answer_keywords,
      difficulty: parsed.data.difficulty,
      hint_1: parsed.data.hint_1 ?? "",
      hint_2: parsed.data.hint_2 ?? "",
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ riddle: data });
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

  const { data: existing } = await supabase
    .from("riddles")
    .select("bar_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing?.bar_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const barId = (parsed.data.bar_id ?? existing.bar_id) as string;
  const owned = await assertBarOwned(supabase, userId, barId);
  if (!owned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("riddles")
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
  return NextResponse.json({ riddle: data });
}

export async function DELETE(request: Request) {
  const session = await requireSessionUser();
  if (!session.ok) return session.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { supabase, userId } = session;
  const { data: existing } = await supabase
    .from("riddles")
    .select("bar_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing?.bar_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const owned = await assertBarOwned(supabase, userId, existing.bar_id as string);
  if (!owned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("riddles").delete().eq("id", id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
