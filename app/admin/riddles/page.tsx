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

  const field =
    "w-full bg-white swiss-border outline-none swiss-body-sm text-black";
  const pad = { padding: "12px 16px" as const };

  return (
    <div className="space-y-10">
      <div className="max-w-lg">
        <label className="swiss-label block mb-2" style={{ fontSize: 10 }}>
          Bar
        </label>
        <select
          className={`${field} max-w-full`}
          style={pad}
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
        className="space-y-6 max-w-lg swiss-border bg-[#fafafa]"
        style={{ padding: 24 }}
      >
        <h2 className="swiss-label" style={{ fontSize: 10 }}>
          Add riddle
        </h2>
        <textarea
          className={`${field} min-h-[80px]`}
          style={pad}
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <input
          className={field}
          style={pad}
          placeholder="Answer keywords, comma-separated"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <div className="flex gap-4 items-center">
          <label className="swiss-label" style={{ fontSize: 10 }}>
            Difficulty 1–3
          </label>
          <input
            type="number"
            min={1}
            max={3}
            className={field}
            style={{ ...pad, width: 64, padding: "8px 12px" }}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          />
        </div>
        <input
          className={field}
          style={pad}
          placeholder="Hint 1"
          value={hint1}
          onChange={(e) => setHint1(e.target.value)}
        />
        <input
          className={field}
          style={pad}
          placeholder="Hint 2"
          value={hint2}
          onChange={(e) => setHint2(e.target.value)}
        />
        <button
          type="submit"
          className="bg-black text-white border-0"
          style={{ padding: "14px 24px", fontSize: 14, fontWeight: 500 }}
        >
          Add
        </button>
      </form>

      <ul className="space-y-0 max-w-4xl">
        {riddles.map((r) => (
          <li
            key={r.id}
            className="swiss-border-b py-6 swiss-body-sm"
            style={{ borderColor: "#e8e8e8" }}
          >
            <div className="text-black whitespace-pre-wrap">{r.question}</div>
            <div className="mt-2" style={{ color: "#999999", fontSize: 12 }}>
              d{r.difficulty} · keywords: {(r.answer_keywords ?? []).join(", ")}
            </div>
            <button
              type="button"
              onClick={() => void del(r.id)}
              className="mt-4 bg-transparent border-0"
              style={{ fontSize: 11, color: "#999999" }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
