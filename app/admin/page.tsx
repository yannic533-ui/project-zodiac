"use client";

import { useEffect, useState } from "react";

type LiveRow = {
  id: string;
  event_name: string | null;
  telegram_chat_id: string;
  group_name: string;
  state: string;
  current_bar_index: number;
  current_bar_name: string | null;
  points: number;
  language: string | null;
};

export default function AdminLivePage() {
  const [groups, setGroups] = useState<LiveRow[]>([]);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState<{
    totalBars: number;
    totalEvents: number;
    totalGroupsPlayed: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as {
        totalBars: number;
        totalEvents: number;
        totalGroupsPlayed: number;
      };
      if (!cancelled) setStats(j);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/admin/live", { credentials: "include" });
      if (!res.ok) {
        if (!cancelled) setErr("Failed to load");
        return;
      }
      const j = (await res.json()) as { groups: LiveRow[] };
      if (!cancelled) {
        setErr("");
        setGroups(j.groups ?? []);
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl text-zinc-100 font-medium">Global live</h1>
      <p className="text-sm text-zinc-500">
        All groups across every event. Refreshes every few seconds. Current bar
        follows the filtered active route for that event.
      </p>
      {stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/40">
            <div className="text-zinc-500 text-xs">Total bars</div>
            <div className="text-lg text-amber-500/90">{stats.totalBars}</div>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/40">
            <div className="text-zinc-500 text-xs">Total events</div>
            <div className="text-lg text-amber-500/90">{stats.totalEvents}</div>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/40">
            <div className="text-zinc-500 text-xs">Total groups (all time)</div>
            <div className="text-lg text-amber-500/90">{stats.totalGroupsPlayed}</div>
          </div>
        </div>
      ) : null}
      {err ? <p className="text-red-400 text-sm">{err}</p> : null}
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="p-2">Group</th>
              <th className="p-2">Chat ID</th>
              <th className="p-2">Event</th>
              <th className="p-2">State</th>
              <th className="p-2">Bar</th>
              <th className="p-2">Pts</th>
              <th className="p-2">Lang</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-zinc-500">
                  No groups yet.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="border-t border-zinc-800">
                  <td className="p-2 text-zinc-200">{g.group_name}</td>
                  <td className="p-2 font-mono text-zinc-400">{g.telegram_chat_id}</td>
                  <td className="p-2 text-zinc-300">{g.event_name ?? "—"}</td>
                  <td className="p-2 text-zinc-300">{g.state}</td>
                  <td className="p-2 text-zinc-300">
                    {g.current_bar_name ?? `#${g.current_bar_index}`}
                  </td>
                  <td className="p-2 text-amber-500/90">{g.points}</td>
                  <td className="p-2 text-zinc-400">{g.language ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
