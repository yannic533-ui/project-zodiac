"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardOverviewPage() {
  const [barCount, setBarCount] = useState<number | null>(null);
  const [livePlayerCount, setLivePlayerCount] = useState(0);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/dashboard/overview", { credentials: "include" });
      if (!res.ok) {
        if (!cancelled) setErr("Could not load overview");
        return;
      }
      const j = (await res.json()) as {
        barCount: number;
        livePlayerCount: number;
        activeEvent: { name: string } | null;
      };
      if (!cancelled) {
        setErr("");
        setBarCount(j.barCount);
        setLivePlayerCount(j.livePlayerCount);
        setActiveName(j.activeEvent?.name ?? null);
      }
    }
    void load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl text-zinc-100 font-medium">Overview</h1>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <div className="text-xs text-zinc-500">Your bars</div>
          <div className="text-2xl text-amber-500/90 mt-1">
            {barCount === null ? "—" : barCount}
          </div>
          <Link
            href="/dashboard/bars"
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
          >
            Manage →
          </Link>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <div className="text-xs text-zinc-500">Active event</div>
          <div className="text-sm text-zinc-200 mt-1">
            {activeName ?? "None"}
          </div>
          <Link
            href="/dashboard/events"
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
          >
            Events →
          </Link>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <div className="text-xs text-zinc-500">Live groups (your active event)</div>
          <div className="text-2xl text-emerald-500/90 mt-1">{livePlayerCount}</div>
          <Link
            href="/dashboard/live"
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 inline-block"
          >
            Live view →
          </Link>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        Need another venue?{" "}
        <Link href="/onboarding" className="text-amber-500/90 hover:text-amber-400">
          Run onboarding
        </Link>
      </p>
    </div>
  );
}
