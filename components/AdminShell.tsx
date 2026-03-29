"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Live" },
  { href: "/admin/owners", label: "Owners" },
  { href: "/admin/bars", label: "Bars" },
  { href: "/admin/riddles", label: "Riddles" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/passphrases", label: "Passphrases" },
  { href: "/admin/message", label: "Send message" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function logout() {
    await Promise.all([
      fetch("/api/admin/logout", { method: "POST", credentials: "include" }),
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }),
    ]);
    router.push("/admin/login");
    router.refresh();
  }

  const pageTitle =
    links.find((l) => l.href === pathname)?.label ?? "Admin";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-black">
      <aside className="swiss-dashboard-aside w-full md:w-[180px] md:shrink-0 flex flex-col md:min-h-screen">
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
          <div className="mt-2 swiss-body-sm" style={{ color: "#999999", fontSize: 11 }}>
            Admin
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
            Log out
          </button>
        </nav>
        <div className="flex-1 hidden md:block" />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="shrink-0 flex items-center px-5 md:px-10 swiss-border-b"
          style={{ height: 48 }}
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
