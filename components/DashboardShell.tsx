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
    <div className="min-h-screen flex flex-col bg-zinc-950 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(245,158,11,0.08),transparent)]">
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_rgba(255,255,255,0.04)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 pr-20 flex flex-wrap items-center gap-4 justify-between">
          <span className="text-amber-400 font-semibold tracking-tight text-lg">
            {t("dash_brand")}
          </span>
          <nav className="flex flex-wrap gap-1 sm:gap-2 text-sm items-center">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  pathname === l.href
                    ? "rounded-md px-2.5 py-1.5 text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20"
                    : "rounded-md px-2.5 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                }
              >
                {l.label}
              </Link>
            ))}
            <span className="w-px h-4 bg-zinc-800 mx-1 hidden sm:block" aria-hidden />
            <Link
              href="/onboarding"
              className="rounded-md px-2.5 py-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
            >
              {t("dash_nav_onboarding")}
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md px-2.5 py-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
            >
              {t("dash_logout")}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-12 pr-20">
        {children}
      </main>
    </div>
  );
}
