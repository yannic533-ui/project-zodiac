"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/locale-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  const links = [
    { href: "/dashboard", label: t("dash_nav_overview") },
    { href: "/dashboard/bars", label: t("dash_nav_bars") },
    { href: "/dashboard/riddles", label: t("dash_nav_riddles") },
    { href: "/dashboard/events", label: t("dash_nav_events") },
    { href: "/dashboard/live", label: t("dash_nav_live") },
    { href: "/dashboard/message", label: t("dash_nav_message") },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 pr-20 flex flex-wrap items-center gap-4 justify-between">
          <span className="text-amber-500/90 font-medium tracking-tight">
            {t("dash_brand")}
          </span>
          <nav className="flex flex-wrap gap-3 text-sm items-center">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  pathname === l.href
                    ? "text-amber-400"
                    : "text-zinc-400 hover:text-zinc-200"
                }
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/onboarding"
              className="text-zinc-500 hover:text-zinc-300"
            >
              {t("dash_nav_onboarding")}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-zinc-500 hover:text-zinc-300"
            >
              {t("dash_logout")}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 pr-20">
        {children}
      </main>
    </div>
  );
}
