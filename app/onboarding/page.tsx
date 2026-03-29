"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  extractPlaceIdFromInput,
  type PlaceDetailsResult,
} from "@/lib/google-places";
import type { OnboardingQa } from "@/lib/onboarding-context";
import type { OnboardingRiddleDraft } from "@/lib/onboarding-riddles";
import { useI18n } from "@/lib/i18n/locale-context";
import {
  QA_CHIPS,
  type MessageKey,
  type OnboardingQaKey,
} from "@/lib/i18n/translations";

type Candidate = { place_id: string; name: string; formatted_address?: string };

const QA_KEYS: { key: OnboardingQaKey; label: MessageKey }[] = [
  { key: "special", label: "ob_q_special" },
  { key: "story", label: "ob_q_story" },
  { key: "regulars", label: "ob_q_regulars" },
  { key: "insider", label: "ob_q_insider" },
];

const TELEGRAM_LINK =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK ?? "https://t.me/";

export default function OnboardingPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [err, setErr] = useState("");
  const [searchPanel, setSearchPanel] = useState<
    | { mode: "list"; candidates: Candidate[] }
    | { mode: "single"; place: PlaceDetailsResult }
    | null
  >(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [place, setPlace] = useState<PlaceDetailsResult | null>(null);
  const committedQueryRef = useRef<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [qa, setQa] = useState<OnboardingQa>({});
  const [riddles, setRiddles] = useState<OnboardingRiddleDraft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [smartChips, setSmartChips] = useState<Record<
    OnboardingQaKey,
    string[]
  > | null>(null);
  const [chipsLoading, setChipsLoading] = useState(false);
  const [chatIdx, setChatIdx] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLog, setChatLog] = useState<{ role: "user"; text: string }[]>([]);
  const [editRiddle, setEditRiddle] = useState<Record<number, boolean>>({});

  const chips = QA_CHIPS[locale];

  const placeForSuggestions = useMemo((): PlaceDetailsResult | null => {
    if (!place) return null;
    return {
      ...place,
      name: editName.trim() || place.name,
      formatted_address: editAddress.trim() || place.formatted_address,
      website: editWebsite.trim() || place.website,
      editorial_summary: editDesc.trim()
        ? { overview: editDesc.trim() }
        : place.editorial_summary,
    };
  }, [place, editName, editAddress, editWebsite, editDesc]);

  const progressPct =
    step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;

  function applyPlaceDetails(p: PlaceDetailsResult) {
    setPlace(p);
    setEditName(p.name);
    setEditAddress(p.formatted_address);
    setEditDesc(p.editorial_summary?.overview ?? "");
    setEditWebsite(p.website ?? "");
    setEditPhone(p.formatted_phone_number ?? p.international_phone_number ?? "");
    setSearchPanel(null);
    setSearchMenuOpen(false);
    committedQueryRef.current = p.name;
    setQuery(p.name);
  }

  useEffect(() => {
    const q = query.trim();
    const fromUrl = extractPlaceIdFromInput(q);
    if (q.length < 3 && !fromUrl) {
      searchSeqRef.current += 1;
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setSearchPanel(null);
      setSearchMenuOpen(false);
      setSearchBusy(false);
      return;
    }

    const mySeq = ++searchSeqRef.current;
    const timer = window.setTimeout(() => {
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      setErr("");
      setSearchBusy(true);
      void (async () => {
        try {
          const res = await fetch("/api/places/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ query: q, languageCode: locale }),
            signal: ac.signal,
          });
          const j = (await res.json()) as
            | { mode: "single"; place: PlaceDetailsResult }
            | { mode: "list"; candidates: Candidate[] }
            | { error?: string };
          if (searchSeqRef.current !== mySeq) return;
          if (!res.ok) {
            setErr((j as { error?: string }).error ?? t("ob_err_search"));
            setSearchPanel(null);
            setSearchMenuOpen(false);
            return;
          }
          if ((j as { mode: string }).mode === "single") {
            setSearchPanel({
              mode: "single",
              place: (j as { place: PlaceDetailsResult }).place,
            });
          } else {
            setSearchPanel({
              mode: "list",
              candidates: (j as { candidates: Candidate[] }).candidates ?? [],
            });
          }
          setSearchMenuOpen(true);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          if (searchSeqRef.current !== mySeq) return;
          setErr(t("ob_err_network"));
          setSearchPanel(null);
        } finally {
          if (searchSeqRef.current === mySeq) setSearchBusy(false);
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timer);
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locale]);

  useEffect(() => {
    if (step !== 2 || !placeForSuggestions) return;
    let cancelled = false;
    setChipsLoading(true);
    setSmartChips(null);
    void (async () => {
      try {
        const res = await fetch("/api/onboarding/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            place: placeForSuggestions,
            languageCode: locale,
          }),
        });
        const j = (await res.json()) as {
          chips?: Record<OnboardingQaKey, string[]>;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setSmartChips(null);
          return;
        }
        setSmartChips(j.chips ?? null);
      } catch {
        if (!cancelled) setSmartChips(null);
      } finally {
        if (!cancelled) setChipsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, placeForSuggestions, locale]);

  useEffect(() => {
    if (step === 2) {
      setChatIdx(0);
      setChatDraft("");
      setChatLog([]);
    }
  }, [step]);

  const currentKey = QA_KEYS[chatIdx]?.key;
  const rowChipsForChat = useMemo(() => {
    if (!currentKey) return [];
    const row =
      smartChips?.[currentKey] && smartChips[currentKey].length > 0
        ? smartChips[currentKey]
        : chips[currentKey];
    return row.slice(0, 3);
  }, [currentKey, smartChips, chips]);

  async function pickCandidate(c: Candidate) {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(c.place_id)}&languageCode=${locale}`,
        { credentials: "include" }
      );
      const j = (await res.json()) as { place?: PlaceDetailsResult; error?: string };
      if (!res.ok) {
        setErr(j.error ?? t("ob_err_place"));
        setLoading(false);
        return;
      }
      if (j.place) {
        applyPlaceDetails(j.place);
      }
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
  }

  function advanceChat() {
    if (chatIdx >= QA_KEYS.length) return;
    const k = QA_KEYS[chatIdx].key;
    const text = chatDraft.trim();
    setQa((q) => ({ ...q, [k]: text || undefined }));
    if (text) setChatLog((l) => [...l, { role: "user", text }]);
    setChatDraft("");
    setChatIdx((i) => i + 1);
  }

  function skipChat() {
    if (chatIdx >= QA_KEYS.length) return;
    const k = QA_KEYS[chatIdx].key;
    setQa((q) => ({ ...q, [k]: undefined }));
    setChatDraft("");
    setChatIdx((i) => i + 1);
  }

  async function generatePack() {
    if (!place) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/generate-riddles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "pack", place, qa }),
      });
      const j = (await res.json()) as {
        riddles?: OnboardingRiddleDraft[];
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? t("ob_err_generate"));
        setLoading(false);
        return;
      }
      setRiddles(j.riddles ?? []);
      setStep(3);
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
  }

  async function regenOne(d: 1 | 2 | 3) {
    if (!place || !riddles) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/generate-riddles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "one",
          place,
          qa,
          difficulty: d,
          existingRiddles: riddles,
        }),
      });
      const j = (await res.json()) as {
        riddle?: OnboardingRiddleDraft;
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? t("ob_err_regen"));
        setLoading(false);
        return;
      }
      if (j.riddle) {
        setRiddles((prev) =>
          (prev ?? []).map((r) => (r.difficulty === d ? j.riddle! : r))
        );
      }
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
  }

  async function complete() {
    if (!place || !riddles?.length) return;
    setErr("");
    setSaving(true);
    try {
      const mergedPlace: PlaceDetailsResult = {
        ...place,
        name: editName.trim() || place.name,
        formatted_address: editAddress.trim() || place.formatted_address,
        website: editWebsite.trim() || undefined,
        formatted_phone_number: editPhone.trim() || undefined,
        editorial_summary: editDesc.trim()
          ? { overview: editDesc.trim() }
          : place.editorial_summary,
      };
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          place: mergedPlace,
          qa,
          name: mergedPlace.name,
          address: mergedPlace.formatted_address,
          riddles,
        }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setErr(j.error ?? t("ob_err_save"));
        setSaving(false);
        return;
      }
      setStep(4);
    } catch {
      setErr(t("ob_err_network"));
    }
    setSaving(false);
  }

  function difficultyLabel(d: number) {
    if (d === 1) return t("ob_diff_easy");
    if (d === 2) return t("ob_diff_medium");
    return t("ob_diff_hard");
  }

  const skipLabel =
    locale === "de"
      ? "Überspringen — nur Google Maps verwenden"
      : "Skip — use Google Maps info only";

  if (step === 2 && place) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col bg-white text-black"
        style={{ fontFamily: "inherit" }}
      >
        <div className="w-full shrink-0 bg-[#e8e8e8]" style={{ height: 1 }} aria-hidden>
          <div className="bg-black h-full" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="swiss-border-b px-4 py-3 shrink-0" style={{ padding: "12px 16px" }}>
          <div className="swiss-body-sm text-black">
            {editName || place.name}
          </div>
          <div className="swiss-body-sm" style={{ color: "#999" }}>
            {editAddress || place.formatted_address}
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto min-h-0"
          style={{ padding: "20px 16px" }}
        >
          <p
            className="text-center swiss-body-sm mb-8"
            style={{ color: "#999", fontSize: 12 }}
          >
            {locale === "de"
              ? "Was sollen wir über deine Bar wissen?"
              : "What should we know about your bar?"}
          </p>
          {chatLog.map((m, i) => (
            <p
              key={`${i}-${m.text.slice(0, 20)}`}
              className="swiss-body-sm mb-4 text-black"
            >
              {m.text}
            </p>
          ))}
          {chipsLoading ? (
            <p className="text-center swiss-body-sm" style={{ color: "#999" }}>
              {t("common_loading")}
            </p>
          ) : null}
          {chatIdx < QA_KEYS.length ? (
            <div className="flex flex-col gap-2 max-w-lg mx-auto">
              {rowChipsForChat.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="text-left bg-white swiss-border hover:border-black swiss-body-sm transition-colors"
                  style={{ padding: "12px 16px" }}
                  onClick={() => setChatDraft(chip)}
                >
                  {chip}
                </button>
              ))}
              <button
                type="button"
                className="text-left bg-white swiss-border swiss-body-sm hover:border-black"
                style={{ padding: "12px 16px", fontSize: 12, color: "#999" }}
                onClick={() => skipChat()}
              >
                {skipLabel}
              </button>
            </div>
          ) : (
            <div className="max-w-lg mx-auto pt-6">
              <button
                type="button"
                disabled={loading}
                onClick={() => void generatePack()}
                className="w-full bg-black text-white swiss-body border-0"
                style={{
                  padding: "14px",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {loading ? t("common_loading") : t("ob_generate")}
              </button>
            </div>
          )}
        </div>
        {chatIdx < QA_KEYS.length ? (
          <div
            className="shrink-0 swiss-border-t bg-white"
            style={{ padding: "12px 16px" }}
          >
            <div
              className="flex items-end gap-2 swiss-border-black"
              style={{ padding: "10px 14px", gap: 8 }}
            >
              <textarea
                className="flex-1 min-h-[24px] max-h-32 bg-transparent border-0 outline-none resize-none swiss-body-sm"
                rows={2}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder=""
              />
              <button
                type="button"
                onClick={() => advanceChat()}
                className="shrink-0 flex items-center justify-center bg-black text-white border-0"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  fontSize: 12,
                  fontWeight: 500,
                }}
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (step === 4) {
    return (
      <div
        className="min-h-screen bg-white text-black flex flex-col items-center justify-center px-5"
        style={{ paddingTop: 40, paddingBottom: 40 }}
      >
        <div className="w-full max-w-[480px] space-y-10 text-center">
          <div style={{ fontSize: 24 }} aria-hidden>
            ✓
          </div>
          <h1
            className="text-black"
            style={{
              fontSize: 20,
              fontWeight: 300,
              letterSpacing: "-0.02em",
            }}
          >
            {locale === "de" ? "Bar angelegt" : "Bar created"}
          </h1>
          <div
            className="text-left font-mono swiss-border bg-[#fafafa]"
            style={{
              fontSize: 12,
              padding: "12px 16px",
              wordBreak: "break-all",
            }}
          >
            {TELEGRAM_LINK}
          </div>
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
            className="w-full bg-black text-white border-0"
            style={{ padding: "14px", fontSize: 14, fontWeight: 500 }}
          >
            {locale === "de" ? "Zum Dashboard" : "Go to dashboard"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black px-5 py-10">
      <div
        className="fixed top-0 left-0 right-0 h-px bg-[#e8e8e8] z-50 pointer-events-none"
        aria-hidden
      >
        <div
          className="h-full bg-black"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="max-w-[480px] mx-auto pt-4">
        <div className="flex justify-between items-center gap-4 mb-10">
          <h1
            className="text-black"
            style={{
              fontSize: 24,
              fontWeight: 300,
              letterSpacing: "-0.02em",
            }}
          >
            {t("ob_title")}
          </h1>
          <Link
            href="/dashboard"
            className="swiss-body-sm hover:opacity-70"
            style={{ color: "#999" }}
          >
            {t("ob_dashboard_link")}
          </Link>
        </div>

        {err ? (
          <p className="swiss-body-sm mb-4" style={{ color: "#999" }}>
            {err}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-6">
            <label className="swiss-label block" style={{ fontSize: 11 }}>
              {t("ob_q1_label")}
            </label>
            <div className="relative">
              <input
                className="w-full bg-white swiss-border-black outline-none"
                style={{
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 300,
                }}
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  if (
                    committedQueryRef.current != null &&
                    v !== committedQueryRef.current
                  ) {
                    committedQueryRef.current = null;
                    setPlace(null);
                  }
                }}
                onFocus={() => {
                  if (searchPanel) setSearchMenuOpen(true);
                }}
                placeholder={t("ob_q1_ph")}
                autoComplete="off"
              />
              {searchBusy ? (
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 swiss-body-sm"
                  style={{ color: "#999", fontSize: 12 }}
                >
                  {t("common_loading")}
                </span>
              ) : null}

              {searchMenuOpen && searchPanel ? (
                <ul
                  className="absolute z-20 mt-0 w-full max-h-64 overflow-auto bg-white swiss-border"
                  style={{ borderTop: "none" }}
                >
                  {searchPanel.mode === "list" &&
                  searchPanel.candidates.length === 0 ? (
                    <li
                      className="swiss-body-sm"
                      style={{ padding: "12px 16px", color: "#999" }}
                    >
                      {locale === "de" ? "Keine Treffer." : "No results."}
                    </li>
                  ) : null}
                  {searchPanel.mode === "list"
                    ? searchPanel.candidates.map((c) => (
                        <li
                          key={c.place_id}
                          className="swiss-border-b last:border-b-0"
                          style={{ borderColor: "#f0f0f0" }}
                        >
                          <button
                            type="button"
                            disabled={loading}
                            className="w-full text-left bg-white hover:bg-[#fafafa] disabled:opacity-50"
                            style={{ padding: "12px 16px" }}
                            onClick={() => void pickCandidate(c)}
                          >
                            <span className="swiss-body-sm text-black">{c.name}</span>
                            {c.formatted_address ? (
                              <span
                                className="block swiss-body-sm mt-1"
                                style={{ color: "#999", fontSize: 12 }}
                              >
                                {c.formatted_address}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))
                    : null}
                  {searchPanel.mode === "single" ? (
                    <li>
                      <button
                        type="button"
                        className="w-full text-left bg-white hover:bg-[#fafafa]"
                        style={{ padding: "12px 16px" }}
                        onClick={() => applyPlaceDetails(searchPanel.place)}
                      >
                        <span className="swiss-body-sm text-black">
                          {searchPanel.place.name}
                        </span>
                        {searchPanel.place.formatted_address ? (
                          <span
                            className="block swiss-body-sm mt-1"
                            style={{ color: "#999", fontSize: 12 }}
                          >
                            {searchPanel.place.formatted_address}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            {place ? (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="swiss-body-sm text-black">{editName || place.name}</p>
                  <p className="swiss-body-sm mt-1" style={{ color: "#999" }}>
                    {editAddress || place.formatted_address}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <label className="swiss-label">{t("ob_label_name")}</label>
                  <input
                    className="w-full swiss-border bg-white outline-none swiss-body-sm"
                    style={{ padding: "10px 14px" }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <label className="swiss-label">{t("ob_label_address")}</label>
                  <input
                    className="w-full swiss-border bg-white outline-none swiss-body-sm"
                    style={{ padding: "10px 14px" }}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                  <label className="swiss-label">{t("ob_label_desc")}</label>
                  <textarea
                    className="w-full swiss-border bg-white outline-none swiss-body-sm min-h-[72px]"
                    style={{ padding: "10px 14px" }}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                  <label className="swiss-label">{t("ob_label_website")}</label>
                  <input
                    className="w-full swiss-border bg-white outline-none swiss-body-sm"
                    style={{ padding: "10px 14px" }}
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                  />
                  <label className="swiss-label">{t("ob_label_phone")}</label>
                  <input
                    className="w-full swiss-border bg-white outline-none swiss-body-sm"
                    style={{ padding: "10px 14px" }}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="w-full bg-black text-white border-0"
                  style={{ padding: "14px", fontSize: 14, fontWeight: 500 }}
                  onClick={() => setStep(2)}
                >
                  {t("ob_continue")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 && riddles ? (
          <div className="flex flex-col gap-10 max-w-[640px] mx-auto">
            <button
              type="button"
              className="text-left swiss-body-sm hover:opacity-70 self-start"
              style={{ color: "#999", fontSize: 11 }}
              onClick={() => setStep(2)}
            >
              {t("common_back")}
            </button>
            {riddles.map((r) => {
              const editing = editRiddle[r.difficulty] ?? false;
              return (
                <div
                  key={r.difficulty}
                  className="swiss-border bg-white"
                  style={{ padding: 20 }}
                >
                  <div className="swiss-label mb-3" style={{ fontSize: 10 }}>
                    {difficultyLabel(r.difficulty)}
                  </div>
                  {editing ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        className="w-full swiss-border bg-white outline-none swiss-body"
                        style={{ padding: "10px 14px", minHeight: 56 }}
                        value={r.question}
                        onChange={(e) =>
                          setRiddles((list) =>
                            (list ?? []).map((x) =>
                              x.difficulty === r.difficulty
                                ? { ...x, question: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                      <input
                        className="w-full swiss-border bg-white outline-none swiss-body-sm"
                        style={{ padding: "10px 14px" }}
                        value={r.answer_keywords.join(", ")}
                        onChange={(e) =>
                          setRiddles((list) =>
                            (list ?? []).map((x) =>
                              x.difficulty === r.difficulty
                                ? {
                                    ...x,
                                    answer_keywords: e.target.value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  }
                                : x
                            )
                          )
                        }
                      />
                      <input
                        className="w-full swiss-border bg-white outline-none swiss-body-sm"
                        style={{ padding: "10px 14px" }}
                        value={r.hint_1}
                        onChange={(e) =>
                          setRiddles((list) =>
                            (list ?? []).map((x) =>
                              x.difficulty === r.difficulty
                                ? { ...x, hint_1: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                      <input
                        className="w-full swiss-border bg-white outline-none swiss-body-sm"
                        style={{ padding: "10px 14px" }}
                        value={r.hint_2}
                        onChange={(e) =>
                          setRiddles((list) =>
                            (list ?? []).map((x) =>
                              x.difficulty === r.difficulty
                                ? { ...x, hint_2: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </div>
                  ) : (
                    <p
                      className="text-black"
                      style={{
                        fontSize: 14,
                        fontWeight: 300,
                        lineHeight: 1.6,
                      }}
                    >
                      {r.question}
                    </p>
                  )}
                  <div className="flex gap-6 mt-4">
                    <button
                      type="button"
                      disabled={loading}
                      className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-70"
                      style={{ fontSize: 11, color: "#999", fontWeight: 300 }}
                      onClick={() => void regenOne(r.difficulty)}
                    >
                      {t("ob_regenerate")}
                    </button>
                    <button
                      type="button"
                      className="bg-transparent border-0 p-0 cursor-pointer hover:opacity-70"
                      style={{ fontSize: 11, color: "#999", fontWeight: 300 }}
                      onClick={() =>
                        setEditRiddle((m) => ({
                          ...m,
                          [r.difficulty]: !editing,
                        }))
                      }
                    >
                      {locale === "de" ? "Bearbeiten" : "Edit"}
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              disabled={saving}
              onClick={() => void complete()}
              className="w-full bg-black text-white border-0"
              style={{ padding: "14px", fontSize: 14, fontWeight: 500 }}
            >
              {saving ? t("ob_saving") : t("ob_save")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
