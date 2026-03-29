"use client";

import { useCallback, useEffect, useState } from "react";

type Bar = {
  id: string;
  name: string;
  address: string;
  active: boolean;
  prize_description: string;
};

export default function DashboardBarsPage() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [prize, setPrize] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/bars", { credentials: "include" });
    if (!res.ok) return;
    const j = (await res.json()) as { bars: Bar[] };
    setBars(j.bars ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addBar(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/dashboard/bars", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, prize_description: prize }),
    });
    if (!res.ok) {
      setMsg("Failed to create");
      return;
    }
    setName("");
    setAddress("");
    setPrize("");
    await load();
  }

  async function toggleActive(b: Bar) {
    await fetch(`/api/dashboard/bars?id=${encodeURIComponent(b.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !b.active }),
    });
    await load();
  }

  async function removeBar(id: string) {
    if (!confirm("Delete bar and its riddles?")) return;
    await fetch(`/api/dashboard/bars?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl text-zinc-100 font-medium">My bars</h1>

      <form
        onSubmit={addBar}
        className="space-y-3 max-w-lg border border-zinc-800 rounded-lg p-4 bg-zinc-900/40"
      >
        <h2 className="text-sm text-zinc-400">Add bar</h2>
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <textarea
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[72px] text-zinc-100"
          placeholder="Prize / notes"
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
        />
        {msg ? <p className="text-sm text-red-400">{msg}</p> : null}
        <button
          type="submit"
          className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium"
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {bars.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center gap-3 border border-zinc-800 rounded-lg p-3 bg-zinc-900/30"
          >
            <div className="flex-1 min-w-[200px]">
              <div className="text-zinc-100">{b.name}</div>
              <div className="text-xs text-zinc-500">{b.address}</div>
              {b.prize_description ? (
                <div className="text-xs text-zinc-400 mt-1">{b.prize_description}</div>
              ) : null}
            </div>
            <span
              className={
                b.active ? "text-emerald-500 text-xs" : "text-zinc-500 text-xs"
              }
            >
              {b.active ? "active" : "inactive"}
            </span>
            <button
              type="button"
              onClick={() => void toggleActive(b)}
              className="text-xs text-amber-500/90 hover:text-amber-400"
            >
              Toggle active
            </button>
            <button
              type="button"
              onClick={() => void removeBar(b.id)}
              className="text-xs text-red-400/90 hover:text-red-300"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
