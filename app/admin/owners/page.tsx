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
    <div className="space-y-10">
      <p className="swiss-body-sm max-w-2xl" style={{ color: "#999999" }}>
        Bar owners and their bars and events. Manage content under Bars, Riddles,
        and Events as usual (service role bypasses row limits).
      </p>
      {err ? (
        <p className="swiss-body-sm" style={{ color: "#999999" }}>
          {err}
        </p>
      ) : null}
      <ul className="space-y-0">
        {owners.map((o) => (
          <li
            key={o.id}
            className="swiss-border-b py-8"
            style={{ borderColor: "#e8e8e8" }}
          >
            <div className="text-black font-medium" style={{ fontWeight: 500, fontSize: 14 }}>
              {o.email ?? o.id}
            </div>
            <div className="font-mono mt-2 swiss-body-sm" style={{ color: "#cccccc", fontSize: 11 }}>
              {o.id}
            </div>
            <div className="mt-6 swiss-label" style={{ fontSize: 10 }}>
              Bars ({o.bars.length})
            </div>
            <ul className="swiss-body-sm mt-2 space-y-2 text-black">
              {o.bars.map((b) => (
                <li key={b.id}>
                  {b.name}{" "}
                  <span style={{ color: "#999999" }}>
                    {b.active ? "· active" : "· inactive"}
                  </span>
                </li>
              ))}
              {o.bars.length === 0 ? (
                <li style={{ color: "#999999" }}>None</li>
              ) : null}
            </ul>
            <div className="mt-6 swiss-label" style={{ fontSize: 10 }}>
              Events ({o.events.length})
            </div>
            <ul className="swiss-body-sm mt-2 space-y-2 text-black">
              {o.events.map((e) => (
                <li key={e.id}>
                  {e.name}{" "}
                  <span style={{ color: "#999999" }}>
                    {e.active ? "· active" : "· inactive"}
                  </span>
                </li>
              ))}
              {o.events.length === 0 ? (
                <li style={{ color: "#999999" }}>None</li>
              ) : null}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
