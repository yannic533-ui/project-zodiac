import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { ADMIN_COOKIE, getAdminPassword } from "@/lib/admin-constants";
import type { ProfileRole } from "@/lib/profile-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function parseCookieValue(
  cookieHeader: string | null,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return undefined;
}

/**
 * Allows either the legacy admin password cookie or a Supabase session with role `super_admin`.
 */
export async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const pwd = getAdminPassword();
  const val = parseCookieValue(request.headers.get("cookie"), ADMIN_COOKIE);
  if (pwd && verifyAdminSession(val, pwd)) {
    return null;
  }

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (pErr) {
      console.error(pErr);
      return NextResponse.json({ error: "Profile error" }, { status: 500 });
    }
    if ((profile?.role as ProfileRole | undefined) !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  } catch (e) {
    console.error(e);
    if (!pwd) {
      return NextResponse.json(
        { error: "Auth not configured" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
