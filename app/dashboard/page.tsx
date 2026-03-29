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
    <div className="space-y-6">
      <h1 className="text-xl text-zinc-100 font-medium">{t("dash_over_title")}</h1>
      {loadFailed ? (
        <p className="text-sm text-red-400">{t("dash_over_err")}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <div className="text-xs text-zinc-500">{t("dash_over_bars")}</div>
          <div className="text-2xl text-amber-500/90 mt-1">
            {barCount === null ? "—" : barCount}
          </div>
          <Link
            href="/dashboard/bars"
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
          >
            {t("dash_over_manage")}
          </Link>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <div className="text-xs text-zinc-500">{t("dash_over_active_event")}</div>
          <div className="text-sm text-zinc-200 mt-1">
            {activeName ?? t("common_none")}
          </div>
          <Link
            href="/dashboard/events"
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
          >
            {t("dash_over_events_link")}
          </Link>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <div className="text-xs text-zinc-500">{t("dash_over_live_groups")}</div>
          <div className="text-2xl text-emerald-500/90 mt-1">{livePlayerCount}</div>
          <Link
            href="/dashboard/live"
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
          >
            {t("dash_over_live_link")}
          </Link>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        {t("dash_over_onboard_prompt")}{" "}
        <Link href="/onboarding" className="text-amber-500/90 hover:text-amber-400">
          {t("dash_over_onboard_link")}
        </Link>
      </p>
    </div>
  );
}
