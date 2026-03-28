import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, getAdminPassword } from "@/lib/admin-constants";
import { verifyAdminSessionEdge } from "@/lib/admin-auth-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  const pwd = getAdminPassword();
  if (!pwd) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const cookieVal = request.cookies.get(ADMIN_COOKIE)?.value;
  const ok = await verifyAdminSessionEdge(cookieVal, pwd);
  if (!ok) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
