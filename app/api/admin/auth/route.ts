import { NextResponse } from "next/server";
import { z } from "zod";
import { signAdminSession } from "@/lib/admin-auth";
import { ADMIN_COOKIE, getAdminPassword } from "@/lib/admin-constants";

const bodySchema = z.object({ password: z.string() });

export async function POST(request: Request) {
  const pwd = getAdminPassword();
  if (!pwd) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD not configured" },
      { status: 500 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.password !== pwd) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = signAdminSession(pwd);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
