import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/profile-sync";

export type SessionOk = {
  ok: true;
  supabase: ReturnType<typeof createSupabaseServerClient>;
  userId: string;
  role: ProfileRole;
};

export type SessionFail = { ok: false; response: NextResponse };

export async function requireSessionUser(): Promise<SessionOk | SessionFail> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as ProfileRole | undefined;
  if (!role || role === "player") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, supabase, userId: user.id, role };
}
