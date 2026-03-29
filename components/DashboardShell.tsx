"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bars", label: "My bars" },
  { href: "/dashboard/riddles", label: "My riddles" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/live", label: "Live view" },
  { href: "/dashboard/message", label: "Send message" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <span className="text-amber-500/90 font-medium tracking-tight">
            Schnuffis — your bars
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
              Add bar
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
