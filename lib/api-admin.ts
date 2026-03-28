import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { ADMIN_COOKIE, getAdminPassword } from "@/lib/admin-constants";

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

export function requireAdmin(request: Request): NextResponse | null {
  const pwd = getAdminPassword();
  if (!pwd) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD not configured" },
      { status: 500 }
    );
  }
  const val = parseCookieValue(request.headers.get("cookie"), ADMIN_COOKIE);
  if (!verifyAdminSession(val, pwd)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
