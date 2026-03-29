"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useI18n } from "@/lib/i18n/locale-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const links = useMemo(
    () => [
      { href: "/dashboard", label: t("dash_nav_overview") },
      { href: "/dashboard/bars", label: t("dash_nav_bars") },
      { href: "/dashboard/riddles", label: t("dash_nav_riddles") },
      { href: "/dashboard/events", label: t("dash_nav_events") },
      { href: "/dashboard/live", label: t("dash_nav_live") },
      { href: "/dashboard/message", label: t("dash_nav_message") },
    ],
    [t]
  );

  const pageTitle = useMemo(() => {
    const map: Record<string, string> = {
      "/dashboard": t("dash_over_title"),
      "/dashboard/bars": t("dash_bars_title"),
      "/dashboard/riddles": t("dash_riddles_title"),
      "/dashboard/events": t("dash_events_title"),
      "/dashboard/live": t("dash_live_title"),
      "/dashboard/message": t("dash_msg_title"),
    };
    return map[pathname] ?? t("dash_over_title");
  }, [pathname, t]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-black">
      <aside className="swiss-dashboard-aside w-full md:w-[180px] md:shrink-0 flex flex-col md:min-h-screen px-0">
        <div className="px-5 pt-8 pb-5 md:pt-10 md:px-5">
          <div
            className="font-medium text-black"
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            SCHNUFFIS
          </div>
        </div>
        <nav className="flex flex-row flex-wrap md:flex-col gap-0 px-2 py-4 md:py-6 md:px-0">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="block md:mx-0 py-2 md:py-2.5 px-3 md:pl-4 md:pr-3"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 500 : 300,
                  color: active ? "#000000" : "#999999",
                  borderLeft: active ? "1.5px solid #000000" : "1.5px solid transparent",
                }}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/onboarding"
            className="block md:mx-0 py-2 md:py-2.5 px-3 md:pl-4 md:pr-3"
            style={{
              fontSize: 13,
              fontWeight: 300,
              color: "#999999",
              borderLeft: "1.5px solid transparent",
            }}
          >
            {t("dash_nav_onboarding")}
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-left block md:mx-0 py-2 md:py-2.5 px-3 md:pl-4 md:pr-3"
            style={{
              fontSize: 13,
              fontWeight: 300,
              color: "#999999",
              borderLeft: "1.5px solid transparent",
            }}
          >
            {t("dash_logout")}
          </button>
        </nav>
        <div className="flex-1 hidden md:block" />
        {email ? (
          <div
            className="hidden md:block px-4 py-6 mt-auto swiss-border-t"
            style={{
              fontSize: 11,
              color: "#cccccc",
            }}
          >
            {email}
          </div>
        ) : null}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="shrink-0 flex items-center px-5 md:px-10 swiss-border-b"
          style={{
            height: 48,
          }}
        >
          <h1
            className="font-medium text-black truncate"
            style={{ fontSize: 13, letterSpacing: "-0.02em" }}
          >
            {pageTitle}
          </h1>
        </header>
        <main className="flex-1 w-full max-w-[960px] mx-auto box-border px-5 py-10 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
