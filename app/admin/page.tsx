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
    <div className="space-y-10">
      <p className="swiss-body-sm max-w-2xl" style={{ color: "#999999" }}>
        All groups across every event. Refreshes every few seconds. Current bar
        follows the filtered active route for that event.
      </p>
      {stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[#fafafa] swiss-border" style={{ padding: 24 }}>
            <div className="swiss-label" style={{ fontSize: 10 }}>
              Total bars
            </div>
            <div className="mt-2 text-black tabular-nums" style={{ fontSize: 32, fontWeight: 300 }}>
              {stats.totalBars}
            </div>
          </div>
          <div className="bg-[#fafafa] swiss-border" style={{ padding: 24 }}>
            <div className="swiss-label" style={{ fontSize: 10 }}>
              Total events
            </div>
            <div className="mt-2 text-black tabular-nums" style={{ fontSize: 32, fontWeight: 300 }}>
              {stats.totalEvents}
            </div>
          </div>
          <div className="bg-[#fafafa] swiss-border" style={{ padding: 24 }}>
            <div className="swiss-label" style={{ fontSize: 10 }}>
              Total groups (all time)
            </div>
            <div className="mt-2 text-black tabular-nums" style={{ fontSize: 32, fontWeight: 300 }}>
              {stats.totalGroupsPlayed}
            </div>
          </div>
        </div>
      ) : null}
      {err ? (
        <p className="swiss-body-sm" style={{ color: "#999999" }}>
          {err}
        </p>
      ) : null}
      <div className="swiss-border overflow-x-auto">
        <table className="w-full text-left border-collapse swiss-body-sm">
          <thead>
            <tr className="swiss-border-b bg-[#fafafa]">
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Group
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Chat ID
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Event
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                State
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Bar
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Pts
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Lang
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 px-3" style={{ color: "#999999" }}>
                  No groups yet.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="swiss-border-b">
                  <td className="py-3 px-3 text-black">{g.group_name}</td>
                  <td className="py-3 px-3 font-mono" style={{ color: "#999999", fontSize: 12 }}>
                    {g.telegram_chat_id}
                  </td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.event_name ?? "—"}
                  </td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.state}
                  </td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.current_bar_name ?? `#${g.current_bar_index}`}
                  </td>
                  <td className="py-3 px-3 text-black tabular-nums">{g.points}</td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.language ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
