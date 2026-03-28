"use client";

import { useCallback, useEffect, useState } from "react";

type Bar = { id: string; name: string; active: boolean };
type EventRow = {
  id: string;
  name: string;
  date: string | null;
  route: string[];
  active: boolean;
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [bars, setBars] = useState<Bar[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [route, setRoute] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [er, br] = await Promise.all([
      fetch("/api/admin/events", { credentials: "include" }),
      fetch("/api/admin/bars?active_only=1", { credentials: "include" }),
    ]);
    if (er.ok) {
      const j = (await er.json()) as { events: EventRow[] };
      setEvents(j.events ?? []);
    }
    if (br.ok) {
      const j = (await br.json()) as { bars: Bar[] };
      setBars(j.bars ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleRouteBar(id: string) {
    setRoute((r) =>
      r.includes(id) ? r.filter((x) => x !== id) : [...r, id]
    );
  }

  function move(idx: number, dir: -1 | 1) {
    setRoute((r) => {
      const n = [...r];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return r;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        date: date ? new Date(date).toISOString() : null,
        route,
        active: false,
      }),
    });
    if (res.ok) {
      setName("");
      setDate("");
      setRoute([]);
      await load();
    }
  }

  async function setActive(id: string) {
    await fetch(`/api/admin/events?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    await load();
  }

  async function deactivate(id: string) {
    await fetch(`/api/admin/events?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    await load();
  }

  async function removeEvent(id: string) {
    if (!confirm("Delete event?")) return;
    await fetch(`/api/admin/events?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  }

  const barName = (id: string) => bars.find((b) => b.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <h1 className="text-xl text-zinc-100 font-medium">Events</h1>
      <p className="text-sm text-zinc-500 max-w-xl">
        Only one event can be active at a time. Route uses active bars only; pick
        order for the hunt.
      </p>

      <form
        onSubmit={createEvent}
        className="space-y-4 max-w-2xl border border-zinc-800 rounded-lg p-4 bg-zinc-900/40"
      >
        <h2 className="text-sm text-zinc-400">Create event</h2>
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="datetime-local"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div>
          <div className="text-xs text-zinc-500 mb-2">Route (active bars)</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {bars.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleRouteBar(b.id)}
                className={
                  route.includes(b.id)
                    ? "text-xs px-2 py-1 rounded bg-amber-600/30 text-amber-200 border border-amber-600/50"
                    : "text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400"
                }
              >
                {b.name}
              </button>
            ))}
          </div>
          <ol className="space-y-1 text-sm text-zinc-300">
            {route.map((id, idx) => (
              <li key={id} className="flex items-center gap-2">
                <span className="text-zinc-500 w-6">{idx + 1}.</span>
                {barName(id)}
                <button
                  type="button"
                  className="text-xs text-zinc-500"
                  onClick={() => move(idx, -1)}
                >
                  up
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-500"
                  onClick={() => move(idx, 1)}
                >
                  down
                </button>
                <button
                  type="button"
                  className="text-xs text-red-400/80"
                  onClick={() =>
                    setRoute((r) => r.filter((x) => x !== id))
                  }
                >
                  remove
                </button>
              </li>
            ))}
          </ol>
        </div>
        <button
          type="submit"
          className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium"
        >
          Create (inactive)
        </button>
      </form>

      <ul className="space-y-3">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30"
          >
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <div className="text-zinc-100 font-medium">{ev.name}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {(ev.route ?? []).map((id) => barName(id)).join(" → ") || "—"}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {ev.active ? (
                  <span className="text-xs text-emerald-500">active</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setActive(ev.id)}
                    className="text-xs text-amber-500"
                  >
                    Set active
                  </button>
                )}
                {ev.active ? (
                  <button
                    type="button"
                    onClick={() => void deactivate(ev.id)}
                    className="text-xs text-zinc-400"
                  >
                    Deactivate
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void removeEvent(ev.id)}
                  className="text-xs text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
