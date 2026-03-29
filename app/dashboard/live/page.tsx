"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

export default function DashboardLivePage() {
  const [groups, setGroups] = useState<LiveRow[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/live", { credentials: "include" });
    if (!res.ok) {
      setErr("Failed to load");
      return;
    }
    const j = (await res.json()) as { groups: LiveRow[] };
    setErr("");
    setGroups(j.groups ?? []);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("dashboard-groups")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => void load()
      )
      .subscribe();
    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl text-zinc-100 font-medium">Live groups</h1>
      <p className="text-sm text-zinc-500">
        Groups playing your events. Updates on an interval and when groups
        change (realtime when enabled in Supabase).
      </p>
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
                  No groups in your events yet.
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
