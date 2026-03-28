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

export default function AdminRiddlesPage() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [barId, setBarId] = useState("");
  const [riddles, setRiddles] = useState<Riddle[]>([]);
  const [question, setQuestion] = useState("");
  const [keywords, setKeywords] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [hint1, setHint1] = useState("");
  const [hint2, setHint2] = useState("");

  const loadBars = useCallback(async () => {
    const res = await fetch("/api/admin/bars", { credentials: "include" });
    if (!res.ok) return;
    const j = (await res.json()) as { bars: Bar[] };
    setBars(j.bars ?? []);
  }, []);

  const loadRiddles = useCallback(async () => {
    if (!barId) return;
    const res = await fetch(
      `/api/admin/riddles?bar_id=${encodeURIComponent(barId)}`,
      { credentials: "include" }
    );
    if (!res.ok) return;
    const j = (await res.json()) as { riddles: Riddle[] };
    setRiddles(j.riddles ?? []);
  }, [barId]);

  useEffect(() => {
    void loadBars();
  }, [loadBars]);

  useEffect(() => {
    if (bars.length > 0 && !barId) setBarId(bars[0].id);
  }, [bars, barId]);

  useEffect(() => {
    void loadRiddles();
  }, [loadRiddles]);

  async function addRiddle(e: React.FormEvent) {
    e.preventDefault();
    const answer_keywords = keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch("/api/admin/riddles", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bar_id: barId,
        question,
        answer_keywords,
        difficulty,
        hint_1: hint1,
        hint_2: hint2,
      }),
    });
    if (res.ok) {
      setQuestion("");
      setKeywords("");
      setHint1("");
      setHint2("");
      await loadRiddles();
    }
  }

  async function del(id: string) {
    if (!confirm("Delete riddle?")) return;
    await fetch(`/api/admin/riddles?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await loadRiddles();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl text-zinc-100 font-medium">Riddles</h1>

      <div className="max-w-lg">
        <label className="text-xs text-zinc-500 block mb-1">Bar</label>
        <select
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
        className="space-y-3 max-w-lg border border-zinc-800 rounded-lg p-4 bg-zinc-900/40"
      >
        <h2 className="text-sm text-zinc-400">Add riddle</h2>
        <textarea
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[80px]"
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Answer keywords, comma-separated"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <div className="flex gap-4 items-center">
          <label className="text-xs text-zinc-500">Difficulty 1–3</label>
          <input
            type="number"
            min={1}
            max={3}
            className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          />
        </div>
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Hint 1"
          value={hint1}
          onChange={(e) => setHint1(e.target.value)}
        />
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Hint 2"
          value={hint2}
          onChange={(e) => setHint2(e.target.value)}
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
            <div className="text-zinc-200 whitespace-pre-wrap">{r.question}</div>
            <div className="text-xs text-zinc-500 mt-2">
              d{r.difficulty} · keywords: {(r.answer_keywords ?? []).join(", ")}
            </div>
            <button
              type="button"
              onClick={() => void del(r.id)}
              className="text-xs text-red-400 mt-2"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
