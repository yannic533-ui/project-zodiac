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
  co_owner_bar_ids: z.array(z.string().uuid()).optional().default([]),
  invited_owner_emails: z.array(z.string().email()).optional().default([]),
  active: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.union([z.string(), z.null()]).optional(),
  route: z.array(z.string().uuid()).optional(),
  co_owner_bar_ids: z.array(z.string().uuid()).optional(),
  invited_owner_emails: z.array(z.string().email()).optional(),
  active: z.boolean().optional(),
});

function normalizeInviteEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const t = e.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

async function assertRouteBarsAllowedForEvent(
  admin: ReturnType<typeof createAdminClient>,
  creatorUserId: string,
  barIds: string[],
  invitedEmailsNorm: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (barIds.length === 0) return { ok: true };

  const unique = [...new Set(barIds)];
  const { data: bars, error } = await admin
    .from("bars")
    .select("id, owner_id")
    .in("id", unique);

  if (error || !bars || bars.length !== unique.length) {
    return { ok: false, error: "Invalid or unknown bars in route" };
  }

  let creatorOwnsAny = false;
  const invitedSet = new Set(invitedEmailsNorm);

  for (const b of bars) {
    const oid = b.owner_id as string;
    if (oid === creatorUserId) {
      creatorOwnsAny = true;
      continue;
    }
    const { data: authData, error: authErr } =
      await admin.auth.admin.getUserById(oid);
    if (authErr || !authData?.user?.email) {
      return {
        ok: false,
        error: "Could not verify a co-owner bar in the route",
      };
    }
    const em = authData.user.email.trim().toLowerCase();
    if (!invitedSet.has(em)) {
      return {
        ok: false,
        error:
          "Co-owner bars need their owner's email on the invite list",
      };
    }
  }

  if (!creatorOwnsAny) {
    return { ok: false, error: "Route must include at least one of your bars" };
  }

  return { ok: true };
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
  const routeIds = [
    ...new Set([...parsed.data.route, ...parsed.data.co_owner_bar_ids]),
  ];
  const invitedNorm = normalizeInviteEmails(parsed.data.invited_owner_emails);

  const admin = createAdminClient();
  const routeOk = await assertRouteBarsAllowedForEvent(
    admin,
    userId,
    routeIds,
    invitedNorm
  );
  if (!routeOk.ok) {
    return NextResponse.json({ error: routeOk.error }, { status: 400 });
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
      invited_owner_emails: invitedNorm,
    })
    .select("*")
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (invitedNorm.length > 0) {
    console.log("[multi-bar-event-invite]", {
      eventId: data.id,
      creatorUserId: userId,
      invitedEmails: invitedNorm,
    });
  }

  if (wantActive) {
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
    .select("id, owner_id, invited_owner_emails, route")
    .eq("id", id)
    .maybeSingle();
  if (evErr || !ev || ev.owner_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existingInvited = normalizeInviteEmails(
    Array.isArray(ev.invited_owner_emails)
      ? (ev.invited_owner_emails as string[])
      : []
  );

  const nextInvited =
    parsed.data.invited_owner_emails !== undefined
      ? normalizeInviteEmails(parsed.data.invited_owner_emails)
      : existingInvited;

  const mergedRoute =
    parsed.data.route !== undefined || parsed.data.co_owner_bar_ids !== undefined
      ? [
          ...new Set([
            ...(parsed.data.route !== undefined
              ? parsed.data.route
              : (ev.route as string[]) ?? []),
            ...(parsed.data.co_owner_bar_ids !== undefined
              ? parsed.data.co_owner_bar_ids
              : []),
          ]),
        ]
      : undefined;

  const finalRouteForCheck =
    mergedRoute !== undefined
      ? mergedRoute
      : ((ev.route as string[]) ?? []);

  const shouldValidateRoute =
    mergedRoute !== undefined ||
    parsed.data.invited_owner_emails !== undefined;

  if (shouldValidateRoute && finalRouteForCheck.length > 0) {
    const admin = createAdminClient();
    const routeOk = await assertRouteBarsAllowedForEvent(
      admin,
      userId,
      finalRouteForCheck,
      nextInvited
    );
    if (!routeOk.ok) {
      return NextResponse.json({ error: routeOk.error }, { status: 400 });
    }
  }

  const updateFields: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateFields.name = parsed.data.name;
  if (parsed.data.date !== undefined) updateFields.date = parsed.data.date;
  if (parsed.data.invited_owner_emails !== undefined) {
    updateFields.invited_owner_emails = nextInvited;
  }
  if (mergedRoute !== undefined) {
    updateFields.route = mergedRoute;
  }
  if (parsed.data.active === false) {
    updateFields.active = false;
  }

  if (parsed.data.active === true) {
    const admin = createAdminClient();
    await activateEventExclusive(admin, id);
    if (Object.keys(updateFields).length === 0) {
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
      .update(updateFields)
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

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("events")
    .update(updateFields)
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
