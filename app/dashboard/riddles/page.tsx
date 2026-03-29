"use client";

import { useCallback, useEffect, useState } from "react";

type Bar = { id: string; name: string };
type Riddle = {
  id: string;
  bar_id: string;
  question: string;
  answer_keywords: string[];
  difficulty: number;
  hint_1: string;
  hint_2: string;
};

export default function DashboardRiddlesPage() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [riddles, setRiddles] = useState<Riddle[]>([]);
  const [barId, setBarId] = useState("");
  const [question, setQuestion] = useState("");
  const [keywords, setKeywords] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [h1, setH1] = useState("");
  const [h2, setH2] = useState("");

  const loadBars = useCallback(async () => {
    const res = await fetch("/api/dashboard/bars", { credentials: "include" });
    if (!res.ok) return;
    const j = (await res.json()) as { bars: Bar[] };
    const next = j.bars ?? [];
    setBars(next);
    setBarId((prev) => prev || next[0]?.id || "");
  }, []);

  const loadRiddles = useCallback(async () => {
    const q = barId ? `?bar_id=${encodeURIComponent(barId)}` : "";
    const res = await fetch(`/api/dashboard/riddles${q}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const j = (await res.json()) as { riddles: Riddle[] };
    setRiddles(j.riddles ?? []);
  }, [barId]);

  useEffect(() => {
    void loadBars();
  }, [loadBars]);

  useEffect(() => {
    void loadRiddles();
  }, [loadRiddles]);

  async function addRiddle(e: React.FormEvent) {
    e.preventDefault();
    if (!barId) return;
    const res = await fetch("/api/dashboard/riddles", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bar_id: barId,
        question,
        answer_keywords: keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        difficulty,
        hint_1: h1,
        hint_2: h2,
      }),
    });
    if (res.ok) {
      setQuestion("");
      setKeywords("");
      setH1("");
      setH2("");
      await loadRiddles();
    }
  }

  async function removeRiddle(id: string) {
    if (!confirm("Delete riddle?")) return;
    await fetch(`/api/dashboard/riddles?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await loadRiddles();
  }

  const barName = (id: string) => bars.find((b) => b.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <h1 className="text-xl text-zinc-100 font-medium">My riddles</h1>
      <p className="text-sm text-zinc-500">
        Pick a bar, then add or review riddles. Difficulty 1–3 maps to easy → hard.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-zinc-400">Bar</label>
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          value={barId}
          onChange={(e) => setBarId(e.target.value)}
        >
          {bars.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <form
        onSubmit={addRiddle}
        className="space-y-3 max-w-xl border border-zinc-800 rounded-lg p-4 bg-zinc-900/40"
      >
        <h2 className="text-sm text-zinc-400">Add riddle</h2>
        <textarea
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[64px] text-zinc-100"
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder="Keywords, comma-separated"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <label className="text-xs text-zinc-500">Difficulty</label>
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          >
            <option value={1}>1 — easy</option>
            <option value={2}>2 — medium</option>
            <option value={3}>3 — hard</option>
          </select>
        </div>
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder="Hint 1"
          value={h1}
          onChange={(e) => setH1(e.target.value)}
        />
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder="Hint 2"
          value={h2}
          onChange={(e) => setH2(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium"
        >
          Add
        </button>
      </form>

      <ul className="space-y-3">
        {riddles.map((r) => (
          <li
            key={r.id}
            className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-sm"
          >
            <div className="text-xs text-zinc-500 mb-1">
              {barName(r.bar_id)} · difficulty {r.difficulty}
            </div>
            <div className="text-zinc-200">{r.question}</div>
            <div className="text-xs text-zinc-500 mt-1">
              Keywords: {r.answer_keywords.join(", ") || "—"}
            </div>
            <button
              type="button"
              className="text-xs text-red-400 mt-2"
              onClick={() => void removeRiddle(r.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
