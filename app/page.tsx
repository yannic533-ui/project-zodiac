"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/locale-context";

export default function Home() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-950 text-zinc-100 pr-24">
      <div className="max-w-lg text-center space-y-6">
        <p className="text-amber-500/90 tracking-tight text-sm uppercase">
          {t("home_kicker")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-medium text-zinc-50 leading-tight">
          {t("home_title")}
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
          {t("home_body")}
        </p>
        <div className="flex flex-wrap gap-4 justify-center pt-2">
          <Link
            href="/login"
            className="rounded-lg bg-amber-600/90 hover:bg-amber-500 text-zinc-950 px-6 py-2.5 text-sm font-medium"
          >
            {t("home_cta_signin")}
          </Link>
          <Link
            href="/login?next=/admin"
            className="rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 px-6 py-2.5 text-sm"
          >
            {t("home_cta_admin")}
          </Link>
        </div>
      </div>
    </main>
  );
}
