"use client";

import { useEffect, useState } from "react";

type Bar = { id: string; name: string; active: boolean };
type Ev = { id: string; name: string; active: boolean };
type Owner = {
  id: string;
  email: string | null;
  bars: Bar[];
  events: Ev[];
};

export default function AdminOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/admin/owners", { credentials: "include" });
      if (!res.ok) {
        if (!cancelled) setErr("Failed to load");
        return;
      }
      const j = (await res.json()) as { owners: Owner[] };
      if (!cancelled) {
        setErr("");
        setOwners(j.owners ?? []);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl text-zinc-100 font-medium">Bar owners</h1>
      <p className="text-sm text-zinc-500 max-w-2xl">
        Bar owners and their bars and events. Manage content under Bars, Riddles,
        and Events as usual (service role bypasses row limits).
      </p>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <ul className="space-y-4">
        {owners.map((o) => (
          <li
            key={o.id}
            className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30"
          >
            <div className="text-zinc-200 font-medium">
              {o.email ?? o.id}
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-1">{o.id}</div>
            <div className="mt-3 text-sm text-zinc-400">
              Bars ({o.bars.length})
            </div>
            <ul className="text-sm text-zinc-300 mt-1 space-y-1">
              {o.bars.map((b) => (
                <li key={b.id}>
                  {b.name}{" "}
                  <span className="text-zinc-600">
                    {b.active ? "· active" : "· inactive"}
                  </span>
                </li>
              ))}
              {o.bars.length === 0 ? (
                <li className="text-zinc-600">None</li>
              ) : null}
            </ul>
            <div className="mt-3 text-sm text-zinc-400">
              Events ({o.events.length})
            </div>
            <ul className="text-sm text-zinc-300 mt-1 space-y-1">
              {o.events.map((e) => (
                <li key={e.id}>
                  {e.name}{" "}
                  <span className="text-zinc-600">
                    {e.active ? "· active" : "· inactive"}
                  </span>
                </li>
              ))}
              {o.events.length === 0 ? (
                <li className="text-zinc-600">None</li>
              ) : null}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
