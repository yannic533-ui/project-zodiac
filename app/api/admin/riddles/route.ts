import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-admin";

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

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const barId = new URL(request.url).searchParams.get("bar_id");
  const sb = createAdminClient();
  let q = sb.from("riddles").select("*").order("difficulty", { ascending: true });
  if (barId) q = q.eq("bar_id", barId);

  const { data, error } = await q;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ riddles: data ?? [] });
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
  const { data: barRow } = await sb
    .from("bars")
    .select("owner_id")
    .eq("id", parsed.data.bar_id)
    .maybeSingle();
  const { data, error } = await sb
    .from("riddles")
    .insert({
      bar_id: parsed.data.bar_id,
      owner_id: (barRow?.owner_id as string | null) ?? null,
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
  const { data, error } = await sb
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
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { error } = await sb.from("riddles").delete().eq("id", id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
