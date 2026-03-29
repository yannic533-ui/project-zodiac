import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, getAdminPassword } from "@/lib/admin-constants";
import { verifyAdminSessionEdge } from "@/lib/admin-auth-edge";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

function redirect(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { response, supabase } = await updateSupabaseSession(request);

  if (pathname.startsWith("/api/webhook")) {
    return response;
  }

  if (!supabase) {
    return response;
  }

  if (pathname.startsWith("/api/places")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return response;
  }

  if (pathname.startsWith("/api/onboarding")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return response;
  }

  if (pathname.startsWith("/api/dashboard")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return response;
  }

  if (pathname === "/login") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const nextParam = request.nextUrl.searchParams.get("next");
      if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
        return NextResponse.redirect(new URL(nextParam, request.url));
      }
      if (profile?.role === "super_admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  if (pathname.startsWith("/auth/callback")) {
    return response;
  }

  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) {
      return response;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "bar_owner") {
        return redirect(request, "/dashboard");
      }
      if (profile?.role === "super_admin") {
        return response;
      }
    }

    const pwd = getAdminPassword();
    if (pwd) {
      const cookieVal = request.cookies.get(ADMIN_COOKIE)?.value;
      const ok = await verifyAdminSessionEdge(cookieVal, pwd);
      if (ok) {
        return response;
      }
    }

    return redirect(request, "/admin/login");
  }

  const protectedPrefixes = ["/dashboard", "/onboarding"];
  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (needsAuth) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const next = `${pathname}${request.nextUrl.search}`;
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.role) {
      return redirect(request, "/login?error=profile");
    }

    if (profile.role === "bar_owner" && pathname.startsWith("/dashboard")) {
      const { count, error } = await supabase
        .from("bars")
        .select("id", { count: "exact", head: true });
      if (!error && (count ?? 0) === 0) {
        return redirect(request, "/onboarding");
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
