"use client";

import { useCallback, useEffect, useState } from "react";

type EventRow = { id: string; name: string };
type PassRow = {
  id: string;
  code: string;
  generated_at: string;
  bar_name: string | null;
};

export default function AdminPassphrasesPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [rows, setRows] = useState<PassRow[]>([]);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/admin/events", { credentials: "include" });
    if (!res.ok) return;
    const j = (await res.json()) as { events: EventRow[] };
    setEvents(j.events ?? []);
  }, []);

  const loadPass = useCallback(async () => {
    if (!eventId) return;
    const res = await fetch(
      `/api/admin/passphrases?event_id=${encodeURIComponent(eventId)}`,
      { credentials: "include" }
    );
    if (!res.ok) {
      setRows([]);
      return;
    }
    const j = (await res.json()) as { passphrases: PassRow[] };
    setRows(j.passphrases ?? []);
  }, [eventId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (events.length > 0 && !eventId) setEventId(events[0].id);
  }, [events, eventId]);

  useEffect(() => {
    void loadPass();
  }, [loadPass]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl text-zinc-100 font-medium">Passphrase log</h1>

      <div className="max-w-md">
        <label className="text-xs text-zinc-500 block mb-1">Event</label>
        <select
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-400 text-left">
            <tr>
              <th className="p-2">When</th>
              <th className="p-2">Bar</th>
              <th className="p-2">Code</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-zinc-500">
                  No passphrases for this event.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800">
                  <td className="p-2 text-zinc-400 whitespace-nowrap">
                    {new Date(r.generated_at).toLocaleString()}
                  </td>
                  <td className="p-2 text-zinc-300">{r.bar_name ?? "—"}</td>
                  <td className="p-2 text-zinc-100 font-mono">{r.code}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
