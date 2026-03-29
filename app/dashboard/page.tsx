"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/locale-context";

export default function DashboardOverviewPage() {
  const { t } = useI18n();
  const [barCount, setBarCount] = useState<number | null>(null);
  const [livePlayerCount, setLivePlayerCount] = useState(0);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/dashboard/overview", { credentials: "include" });
      if (!res.ok) {
        if (!cancelled) setLoadFailed(true);
        return;
      }
      const j = (await res.json()) as {
        barCount: number;
        livePlayerCount: number;
        activeEvent: { name: string } | null;
      };
      if (!cancelled) {
        setLoadFailed(false);
        setBarCount(j.barCount);
        setLivePlayerCount(j.livePlayerCount);
        setActiveName(j.activeEvent?.name ?? null);
      }
    }
    void load();
    const timer = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-50">
          {t("dash_over_title")}
        </h1>
        <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
          {t("dash_over_onboard_prompt")}{" "}
          <Link
            href="/onboarding"
            className="text-amber-400/95 hover:text-amber-300 font-medium underline-offset-2 hover:underline"
          >
            {t("dash_over_onboard_link")}
          </Link>
        </p>
      </div>

      {loadFailed ? (
        <p className="text-sm text-red-400 rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-3">
          {t("dash_over_err")}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/35 p-6 shadow-lg shadow-black/20 ring-1 ring-white/[0.04] transition hover:border-zinc-700/90 hover:bg-zinc-900/50">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent opacity-80" />
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {t("dash_over_bars")}
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums text-amber-400/95">
            {barCount === null ? "—" : barCount}
          </div>
          <Link
            href="/dashboard/bars"
            className="mt-4 inline-flex text-xs font-medium text-zinc-400 hover:text-amber-400/90"
          >
            {t("dash_over_manage")} →
          </Link>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/35 p-6 shadow-lg shadow-black/20 ring-1 ring-white/[0.04] transition hover:border-zinc-700/90 hover:bg-zinc-900/50">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/25 to-transparent opacity-80" />
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {t("dash_over_active_event")}
          </div>
          <div className="mt-3 text-base font-medium text-zinc-100 leading-snug line-clamp-2">
            {activeName ?? t("common_none")}
          </div>
          <Link
            href="/dashboard/events"
            className="mt-4 inline-flex text-xs font-medium text-zinc-400 hover:text-amber-400/90"
          >
            {t("dash_over_events_link")} →
          </Link>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/35 p-6 shadow-lg shadow-black/20 ring-1 ring-white/[0.04] transition hover:border-zinc-700/90 hover:bg-zinc-900/50">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent opacity-80" />
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {t("dash_over_live_groups")}
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums text-emerald-400/95">
            {livePlayerCount}
          </div>
          <Link
            href="/dashboard/live"
            className="mt-4 inline-flex text-xs font-medium text-zinc-400 hover:text-emerald-400/90"
          >
            {t("dash_over_live_link")} →
          </Link>
        </div>
      </div>
    </div>
  );
}
