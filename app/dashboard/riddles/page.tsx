"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/locale-context";

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

const field =
  "w-full bg-white swiss-border outline-none swiss-body-sm text-black";
const pad = { padding: "12px 16px" as const };

export default function DashboardRiddlesPage() {
  const { t } = useI18n();
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
    if (!confirm(t("dash_riddles_confirm_delete"))) return;
    await fetch(`/api/dashboard/riddles?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await loadRiddles();
  }

  const barName = (id: string) => bars.find((b) => b.id === id)?.name ?? id;

  return (
    <div className="space-y-10">
      <p className="swiss-body-sm max-w-xl" style={{ color: "#999999" }}>
        {t("dash_riddles_intro")}
      </p>

      <div className="flex flex-wrap gap-4 items-center">
        <label className="swiss-label" style={{ fontSize: 10 }}>
          {t("dash_riddles_bar_label")}
        </label>
        <select
          className={`${field} max-w-xs`}
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
        className="space-y-6 max-w-xl swiss-border bg-[#fafafa]"
        style={{ padding: 24 }}
      >
        <h2 className="swiss-label" style={{ fontSize: 10 }}>
          {t("dash_riddles_add_title")}
        </h2>
        <textarea
          className={`${field} min-h-[64px]`}
          style={pad}
          placeholder={t("dash_riddles_q_ph")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <input
          className={field}
          style={pad}
          placeholder={t("dash_riddles_kw_ph")}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <div className="flex gap-4 items-center">
          <label className="swiss-label" style={{ fontSize: 10 }}>
            {t("dash_riddles_diff_label")}
          </label>
          <select
            className={field}
            style={{ ...pad, padding: "8px 12px" }}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          >
            <option value={1}>{t("dash_riddles_diff_1")}</option>
            <option value={2}>{t("dash_riddles_diff_2")}</option>
            <option value={3}>{t("dash_riddles_diff_3")}</option>
          </select>
        </div>
        <input
          className={field}
          style={pad}
          placeholder={t("dash_riddles_hint1_ph")}
          value={h1}
          onChange={(e) => setH1(e.target.value)}
        />
        <input
          className={field}
          style={pad}
          placeholder={t("dash_riddles_hint2_ph")}
          value={h2}
          onChange={(e) => setH2(e.target.value)}
        />
        <button
          type="submit"
          className="bg-black text-white border-0"
          style={{ padding: "14px 24px", fontSize: 14, fontWeight: 500 }}
        >
          {t("dash_riddles_add_btn")}
        </button>
      </form>

      <ul className="space-y-0 max-w-4xl">
        {riddles.map((r) => (
          <li
            key={r.id}
            className="swiss-border-b py-6"
            style={{ borderColor: "#e8e8e8" }}
          >
            <div className="swiss-label mb-2" style={{ fontSize: 10 }}>
              {t("dash_riddles_list_meta", {
                bar: barName(r.bar_id),
                n: r.difficulty,
              })}
            </div>
            <div className="swiss-body-sm text-black">{r.question}</div>
            <div className="swiss-body-sm mt-2" style={{ color: "#999999", fontSize: 12 }}>
              {t("dash_riddles_kw_label")}{" "}
              {r.answer_keywords.join(", ") || "—"}
            </div>
            <button
              type="button"
              className="mt-4 bg-transparent border-0"
              style={{ fontSize: 11, color: "#999999" }}
              onClick={() => void removeRiddle(r.id)}
            >
              {t("dash_riddles_delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
