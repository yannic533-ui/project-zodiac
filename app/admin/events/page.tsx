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

  const field =
    "w-full bg-white swiss-border outline-none swiss-body-sm text-black";
  const pad = { padding: "12px 16px" as const };

  return (
    <div className="space-y-10">
      <p className="swiss-body-sm max-w-xl" style={{ color: "#999999" }}>
        Only one event can be active at a time. Route uses active bars only; pick
        order for the hunt.
      </p>

      <form
        onSubmit={createEvent}
        className="space-y-6 max-w-2xl swiss-border bg-[#fafafa]"
        style={{ padding: 24 }}
      >
        <h2 className="swiss-label" style={{ fontSize: 10 }}>
          Create event
        </h2>
        <input
          className={field}
          style={pad}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="datetime-local"
          className={field}
          style={pad}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div>
          <div className="swiss-label mb-4" style={{ fontSize: 10 }}>
            Route (active bars)
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {bars.map((b) => {
              const on = route.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleRouteBar(b.id)}
                  className="swiss-border swiss-body-sm"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 2,
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                    backgroundColor: on ? "#000000" : "#f0f0f0",
                    color: on ? "#ffffff" : "#999999",
                    borderColor: "#e8e8e8",
                  }}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
          <ol className="space-y-2">
            {route.map((id, idx) => (
              <li key={id} className="flex flex-wrap items-center gap-4 swiss-body-sm text-black">
                <span style={{ color: "#999999", width: 24 }}>{idx + 1}.</span>
                {barName(id)}
                <button
                  type="button"
                  className="bg-transparent border-0"
                  style={{ fontSize: 11, color: "#999999" }}
                  onClick={() => move(idx, -1)}
                >
                  up
                </button>
                <button
                  type="button"
                  className="bg-transparent border-0"
                  style={{ fontSize: 11, color: "#999999" }}
                  onClick={() => move(idx, 1)}
                >
                  down
                </button>
                <button
                  type="button"
                  className="bg-transparent border-0"
                  style={{ fontSize: 11, color: "#999999" }}
                  onClick={() => setRoute((r) => r.filter((x) => x !== id))}
                >
                  remove
                </button>
              </li>
            ))}
          </ol>
        </div>
        <button
          type="submit"
          className="bg-black text-white border-0"
          style={{ padding: "14px 24px", fontSize: 14, fontWeight: 500 }}
        >
          Create (inactive)
        </button>
      </form>

      <ul className="space-y-0 max-w-4xl">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="swiss-border-b swiss-body-sm py-6 flex flex-wrap items-start justify-between gap-4"
            style={{ borderColor: "#e8e8e8" }}
          >
            <div>
              <div className="text-black font-medium" style={{ fontWeight: 500, fontSize: 14 }}>
                {ev.name}
              </div>
              <div className="mt-2" style={{ color: "#999999", fontSize: 12 }}>
                {(ev.route ?? []).map((id) => barName(id)).join(" → ") || "—"}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              {ev.active ? (
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 2,
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    backgroundColor: "#000000",
                    color: "#ffffff",
                  }}
                >
                  active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void setActive(ev.id)}
                  className="bg-transparent border-0"
                  style={{ fontSize: 11, color: "#999999" }}
                >
                  Set active
                </button>
              )}
              {ev.active ? (
                <button
                  type="button"
                  onClick={() => void deactivate(ev.id)}
                  className="bg-transparent border-0"
                  style={{ fontSize: 11, color: "#999999" }}
                >
                  Deactivate
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void removeEvent(ev.id)}
                className="bg-transparent border-0"
                style={{ fontSize: 11, color: "#999999" }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
