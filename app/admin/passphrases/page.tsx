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
    <div className="space-y-10">
      <div className="max-w-md">
        <label className="swiss-label block mb-2" style={{ fontSize: 10 }}>
          Event
        </label>
        <select
          className="w-full bg-white swiss-border outline-none swiss-body-sm"
          style={{ padding: "12px 16px" }}
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

      <div className="swiss-border overflow-x-auto">
        <table className="w-full text-left border-collapse swiss-body-sm">
          <thead>
            <tr className="swiss-border-b bg-[#fafafa]">
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                When
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Bar
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                Code
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 px-3" style={{ color: "#999999" }}>
                  No passphrases for this event.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="swiss-border-b">
                  <td className="py-3 px-3 whitespace-nowrap" style={{ color: "#999999" }}>
                    {new Date(r.generated_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {r.bar_name ?? "—"}
                  </td>
                  <td className="py-3 px-3 font-mono text-black">{r.code}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
