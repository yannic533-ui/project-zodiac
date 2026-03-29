"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  extractPlaceIdFromInput,
  placePhotoProxyUrl,
  type PlaceDetailsResult,
} from "@/lib/google-places";
import type { OnboardingQa } from "@/lib/onboarding-context";
import type { OnboardingRiddleDraft } from "@/lib/onboarding-riddles";
import { useI18n } from "@/lib/i18n/locale-context";
import type { OnboardingQaKey } from "@/lib/i18n/translations";

type Candidate = { place_id: string; name: string; formatted_address?: string };

type ChatPhase =
  | "search"
  | "confirm_bar"
  | "qa"
  | "generating"
  | "review_riddles"
  | "done";

type BaseMsg = { id: string };

type UserTextMsg = BaseMsg & { role: "user"; kind: "text"; text: string };

type AgentTextMsg = BaseMsg & { role: "agent"; kind: "text"; text: string };

type PlaceCardMsg = BaseMsg & {
  role: "agent";
  kind: "place_card";
  place: PlaceDetailsResult;
};

type SearchResultsMsg = BaseMsg & {
  role: "ui";
  kind: "search_results";
  candidates: Candidate[];
};

type SuggestionsMsg = BaseMsg & {
  role: "ui";
  kind: "suggestions";
  items: string[];
};

type RiddleMsg = BaseMsg & {
  role: "agent";
  kind: "riddle";
  riddle: OnboardingRiddleDraft;
};

type ReviewPromptMsg = BaseMsg & {
  role: "agent";
  kind: "review_prompt";
};

type ConfirmBarMsg = BaseMsg & {
  role: "ui";
  kind: "confirm_bar";
};

type ChatMessage =
  | UserTextMsg
  | AgentTextMsg
  | PlaceCardMsg
  | SearchResultsMsg
  | SuggestionsMsg
  | RiddleMsg
  | ReviewPromptMsg
  | ConfirmBarMsg;

const TELEGRAM_LINK =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK ?? "https://t.me/";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isDoneMessage(raw: string, locale: "de" | "en"): boolean {
  const t = raw.trim().toLowerCase();
  if (locale === "de") {
    return (
      t === "nein" ||
      t === "reicht" ||
      t === "nichts" ||
      t === "nein." ||
      t === "reicht." ||
      t === "nichts."
    );
  }
  return (
    t === "no" ||
    t === "enough" ||
    t === "nothing" ||
    t === "no." ||
    t === "enough." ||
    t === "nothing."
  );
}

function buildQaFromNotes(notes: string[]): OnboardingQa {
  if (notes.length === 0) return {};
  return { special: notes.join("\n\n") };
}

function pickThreeSuggestions(
  chips: Record<OnboardingQaKey, string[]> | null
): string[] {
  if (!chips) return [];
  const order: OnboardingQaKey[] = [
    "special",
    "story",
    "regulars",
    "insider",
  ];
  const out: string[] = [];
  for (const k of order) {
    const row = chips[k];
    if (row?.length) {
      for (const c of row) {
        if (!out.includes(c)) out.push(c);
        if (out.length >= 3) return out;
      }
    }
  }
  return out;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const lc = locale === "en" ? "en" : "de";

  const copy = useMemo(
    () =>
      lc === "de"
        ? {
            open: "Welche Bar möchtest du hinzufügen?",
            confirm: "Ist das richtig?",
            ja: "Ja",
            otherBar: "Andere Bar suchen",
            whatElse: (name: string) =>
              `${name}. Was sollen wir noch wissen?`,
            noch: "Noch etwas?",
            moment: "Einen Moment.",
            reviewAsk: "Schau sie durch. Alles in Ordnung?",
            looksGood: "Sieht gut aus",
            regenAll: "Neu generieren",
            live: (name: string) => `${name} ist jetzt live.`,
            genRiddles: "Rätsel generieren →",
            dashboard: "Zum Dashboard",
            neu: "Neu",
            bearbeiten: "Bearbeiten",
            noHits: "Keine Treffer.",
            searchAgain: "Welche Bar möchtest du hinzufügen?",
          }
        : {
            open: "Which bar do you want to add?",
            confirm: "Is this the one?",
            ja: "Yes",
            otherBar: "Search for another bar",
            whatElse: (name: string) =>
              `${name}. What else should we know?`,
            noch: "Anything else?",
            moment: "One moment.",
            reviewAsk: "Look them over. All good?",
            looksGood: "Looks good",
            regenAll: "Generate again",
            live: (name: string) => `${name} is live.`,
            genRiddles: "Generate riddles →",
            dashboard: "Go to dashboard",
            neu: "New",
            bearbeiten: "Edit",
            noHits: "No results.",
            searchAgain: "Which bar do you want to add?",
          },
    [lc]
  );

  const [phase, setPhase] = useState<ChatPhase>("search");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [searchPanel, setSearchPanel] = useState<
    | { mode: "list"; candidates: Candidate[] }
    | { mode: "single"; place: PlaceDetailsResult }
    | null
  >(null);
  const [place, setPlace] = useState<PlaceDetailsResult | null>(null);
  const [qaNotes, setQaNotes] = useState<string[]>([]);
  const [riddles, setRiddles] = useState<OnboardingRiddleDraft[] | null>(null);
  const [smartChips, setSmartChips] = useState<Record<
    OnboardingQaKey,
    string[]
  > | null>(null);
  const [chipsLoading, setChipsLoading] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const [editRiddle, setEditRiddle] = useState<Record<number, boolean>>({});
  const [progressPct, setProgressPct] = useState(0);
  const [firstQaMessageSent, setFirstQaMessageSent] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);
  const committedQueryRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seededRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const qa: OnboardingQa = useMemo(
    () => buildQaFromNotes(qaNotes),
    [qaNotes]
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, searchPanel, scrollToBottom]);

  const appendMessages = useCallback((next: ChatMessage[]) => {
    setMessages((m) => [...m, ...next]);
  }, []);

  const withTyping = useCallback(
    async (fn: () => Promise<void> | void) => {
      setTyping(true);
      await delay(300);
      setTyping(false);
      await fn();
      await delay(300);
    },
    []
  );

  /** Seed opening agent line once */
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void (async () => {
      await withTyping(async () => {
        appendMessages([
          { id: uid(), role: "agent", kind: "text", text: copy.open },
        ]);
      });
    })();
  }, [appendMessages, copy.open, withTyping]);

  /** Debounced places search */
  useEffect(() => {
    if (phase !== "search") return;

    const q = query.trim();
    const fromUrl = extractPlaceIdFromInput(q);
    if (q.length < 3 && !fromUrl) {
      searchSeqRef.current += 1;
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setSearchPanel(null);
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
            return;
          }
          if ((j as { mode: string }).mode === "single") {
            setSearchPanel({
              mode: "single",
              place: (j as { place: PlaceDetailsResult }).place,
            });
          } else {
            const list = (j as { candidates: Candidate[] }).candidates ?? [];
            setSearchPanel({
              mode: "list",
              candidates: list.slice(0, 3),
            });
          }
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
  }, [query, locale, phase, t]);

  /** Fetch suggestions when entering QA */
  useEffect(() => {
    if (phase !== "qa" || !place) return;
    let cancelled = false;
    setChipsLoading(true);
    setSmartChips(null);
    setSuggestionsVisible(true);
    void (async () => {
      try {
        const res = await fetch("/api/onboarding/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            place,
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
  }, [phase, place, locale]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  async function pickCandidate(c: Candidate) {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(c.place_id)}&languageCode=${locale}`,
        { credentials: "include" }
      );
      const j = (await res.json()) as {
        place?: PlaceDetailsResult;
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? t("ob_err_place"));
        setLoading(false);
        return;
      }
      if (!j.place) {
        setLoading(false);
        return;
      }
      const p = j.place;
      setPlace(p);
      committedQueryRef.current = p.name;
      setQuery(p.name);
      setSearchPanel(null);
      appendMessages([
        { id: uid(), role: "agent", kind: "place_card", place: p },
        { id: uid(), role: "agent", kind: "text", text: copy.confirm },
        { id: uid(), role: "ui", kind: "confirm_bar" },
      ]);
      setPhase("confirm_bar");
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
  }

  function onConfirmJa() {
    if (!place) return;
    setProgressPct(25);
    setPhase("qa");
    setQaNotes([]);
    setFirstQaMessageSent(false);
    setInput("");
    appendMessages([
      {
        id: uid(),
        role: "agent",
        kind: "text",
        text: copy.whatElse(place.name),
      },
    ]);
  }

  useEffect(() => {
    if (phase !== "qa" || !place || chipsLoading) return;
    const items = pickThreeSuggestions(smartChips);
    const hasSuggestions = messagesRef.current.some(
      (m) => m.role === "ui" && m.kind === "suggestions"
    );
    if (items.length === 0 || hasSuggestions) return;
    appendMessages([{ id: uid(), role: "ui", kind: "suggestions", items }]);
  }, [phase, place, smartChips, chipsLoading, appendMessages]);

  function onConfirmOther() {
    setPlace(null);
    setPhase("search");
    setSearchPanel(null);
    committedQueryRef.current = null;
    setQuery("");
    setInput("");
    void withTyping(async () => {
      appendMessages([
        { id: uid(), role: "agent", kind: "text", text: copy.searchAgain },
      ]);
    });
  }

  const stripReviewTail = useCallback((list: ChatMessage[]): ChatMessage[] => {
    return list.filter((m) => {
      if (m.kind === "riddle" || m.kind === "review_prompt") return false;
      if (
        m.role === "agent" &&
        m.kind === "text" &&
        m.text === copy.reviewAsk
      ) {
        return false;
      }
      return true;
    });
  }, [copy.reviewAsk]);

  const generatePack = useCallback(
    async (opts?: { replaceReview?: boolean }) => {
      if (!place) return;
      setErr("");
      setLoading(true);
      setPhase("generating");
      try {
        await withTyping(async () => {
          appendMessages([
            { id: uid(), role: "agent", kind: "text", text: copy.moment },
          ]);
        });
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
          setPhase(opts?.replaceReview ? "review_riddles" : "qa");
          setLoading(false);
          return;
        }
        const pack = j.riddles ?? [];
        if (opts?.replaceReview) {
          setMessages((m) => stripReviewTail(m));
        }
        setRiddles(pack);
        setProgressPct(75);
        setPhase("review_riddles");
        setEditRiddle({});

        const sorted = [...pack].sort((a, b) => a.difficulty - b.difficulty);
        for (let i = 0; i < sorted.length; i++) {
          if (i > 0) await delay(400);
          await withTyping(async () => {
            appendMessages([
              { id: uid(), role: "agent", kind: "riddle", riddle: sorted[i] },
            ]);
          });
        }

        await delay(300);
        appendMessages([
          { id: uid(), role: "agent", kind: "text", text: copy.reviewAsk },
          { id: uid(), role: "agent", kind: "review_prompt" },
        ]);
      } catch {
        setErr(t("ob_err_network"));
        setPhase(opts?.replaceReview ? "review_riddles" : "qa");
      }
      setLoading(false);
    },
    [place, qa, appendMessages, copy, t, withTyping, stripReviewTail]
  );

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
        setMessages((m) =>
          m.map((msg) =>
            msg.kind === "riddle" && msg.riddle.difficulty === d
              ? { ...msg, riddle: j.riddle! }
              : msg
          )
        );
      }
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
  }

  async function completeSave() {
    if (!place || !riddles?.length) return;
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          place,
          qa,
          name: place.name,
          address: place.formatted_address,
          riddles,
        }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setErr(j.error ?? t("ob_err_save"));
        setSaving(false);
        return;
      }
      setProgressPct(100);
      setPhase("done");
      await withTyping(async () => {
        appendMessages([
          {
            id: uid(),
            role: "agent",
            kind: "text",
            text: copy.live(place.name),
          },
        ]);
      });
    } catch {
      setErr(t("ob_err_network"));
    }
    setSaving(false);
  }

  async function onRegenerateAllRiddles() {
    await generatePack({ replaceReview: true });
  }

  async function onGenerateClick() {
    if (!firstQaMessageSent) {
      setFirstQaMessageSent(true);
      setProgressPct(50);
    }
    await generatePack();
  }

  async function handleQaSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    appendMessages([{ id: uid(), role: "user", kind: "text", text: trimmed }]);
    setInput("");

    if (!firstQaMessageSent) {
      setFirstQaMessageSent(true);
      setProgressPct(50);
    }

    if (isDoneMessage(trimmed, lc)) {
      await generatePack();
      return;
    }

    setQaNotes((n) => [...n, trimmed]);
    await withTyping(async () => {
      appendMessages([
        { id: uid(), role: "agent", kind: "text", text: copy.noch },
      ]);
    });
  }

  function difficultyUpper(d: number): string {
    if (d === 1) return t("ob_diff_easy").toUpperCase();
    if (d === 2) return t("ob_diff_medium").toUpperCase();
    return t("ob_diff_hard").toUpperCase();
  }

  function photoUrl(p: PlaceDetailsResult): string | null {
    const ref = p.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return placePhotoProxyUrl(ref, 640);
  }

  function patchRiddleMessage(
    msgId: string,
    difficulty: number,
    patch: Partial<OnboardingRiddleDraft>
  ) {
    setRiddles((list) =>
      (list ?? []).map((x) =>
        x.difficulty === difficulty ? { ...x, ...patch } : x
      )
    );
    setMessages((msgs) =>
      msgs.map((msg) =>
        msg.id === msgId && msg.kind === "riddle"
          ? { ...msg, riddle: { ...msg.riddle, ...patch } }
          : msg
      )
    );
  }

  const inputDisabled =
    phase === "confirm_bar" ||
    phase === "generating" ||
    phase === "review_riddles" ||
    phase === "done" ||
    loading ||
    saving;

  const showGenButton = phase === "qa" && !loading && !saving;

  function onSendClick() {
    if (phase === "qa") {
      void handleQaSend(input);
    }
  }

  const baseTextStyle: CSSProperties = {
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    fontWeight: 300,
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-white text-black"
      style={baseTextStyle}
    >
      <div
        className="w-full shrink-0 bg-[#e8e8e8]"
        style={{ height: 1 }}
        aria-hidden
      >
        <div
          className="h-full bg-black transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden mx-auto w-full max-w-[640px] min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0"
          style={{ padding: "24px 16px" }}
        >
          <div className="flex flex-col" style={{ gap: 12 }}>
            {messages.map((m) => {
              if (m.role === "user" && m.kind === "text") {
                const ut = m.text;
                return (
                  <div key={m.id} className="flex justify-end w-full">
                    <div
                      className="max-w-[75%] text-white bg-black"
                      style={{
                        borderRadius: 16,
                        padding: "10px 14px",
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      {ut}
                    </div>
                  </div>
                );
              }

              if (m.role === "agent" && m.kind === "text") {
                return (
                  <div key={m.id} className="flex justify-start w-full">
                    <p
                      className="max-w-[75%]"
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "#000",
                        margin: 0,
                      }}
                    >
                      {m.text}
                    </p>
                  </div>
                );
              }

              if (m.role === "agent" && m.kind === "place_card") {
                const src = photoUrl(m.place);
                return (
                  <div key={m.id} className="flex justify-start w-full">
                    <div className="max-w-[75%] space-y-2">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          className="w-full max-h-48 object-cover"
                          style={{
                            border: "0.5px solid #e8e8e8",
                          }}
                        />
                      ) : null}
                      <p
                        style={{
                          fontSize: 14,
                          lineHeight: 1.6,
                          color: "#000",
                          margin: 0,
                        }}
                      >
                        {m.place.name}
                      </p>
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "#666",
                          margin: 0,
                        }}
                      >
                        {m.place.formatted_address}
                      </p>
                    </div>
                  </div>
                );
              }

              if (m.role === "agent" && m.kind === "riddle") {
                const r = m.riddle;
                const editing = editRiddle[r.difficulty] ?? false;
                return (
                  <div key={m.id} className="flex justify-start w-full">
                    <div className="max-w-[75%] w-full space-y-2">
                      <p
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.06em",
                          color: "#666",
                          margin: 0,
                        }}
                      >
                        {difficultyUpper(r.difficulty)}
                      </p>
                      {editing ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full bg-white outline-none resize-y"
                            style={{
                              border: "0.5px solid #e8e8e8",
                              padding: "10px 14px",
                              fontSize: 14,
                              fontWeight: 300,
                              minHeight: 56,
                            }}
                            value={r.question}
                            onChange={(e) =>
                              patchRiddleMessage(m.id, r.difficulty, {
                                question: e.target.value,
                              })
                            }
                          />
                          <input
                            className="w-full bg-white outline-none"
                            style={{
                              border: "0.5px solid #e8e8e8",
                              padding: "10px 14px",
                              fontSize: 13,
                              fontWeight: 300,
                            }}
                            value={r.answer_keywords.join(", ")}
                            onChange={(e) =>
                              patchRiddleMessage(m.id, r.difficulty, {
                                answer_keywords: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                          <input
                            className="w-full bg-white outline-none"
                            style={{
                              border: "0.5px solid #e8e8e8",
                              padding: "10px 14px",
                              fontSize: 13,
                              fontWeight: 300,
                            }}
                            value={r.hint_1}
                            onChange={(e) =>
                              patchRiddleMessage(m.id, r.difficulty, {
                                hint_1: e.target.value,
                              })
                            }
                          />
                          <input
                            className="w-full bg-white outline-none"
                            style={{
                              border: "0.5px solid #e8e8e8",
                              padding: "10px 14px",
                              fontSize: 13,
                              fontWeight: 300,
                            }}
                            value={r.hint_2}
                            onChange={(e) =>
                              patchRiddleMessage(m.id, r.difficulty, {
                                hint_2: e.target.value,
                              })
                            }
                          />
                        </div>
                      ) : (
                        <p
                          style={{
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: "#000",
                            margin: 0,
                          }}
                        >
                          {r.question}
                        </p>
                      )}
                      <div className="flex gap-4 pt-1">
                        <button
                          type="button"
                          disabled={loading}
                          className="bg-transparent border-0 cursor-pointer disabled:opacity-50 p-0"
                          style={{
                            fontSize: 12,
                            color: "#666",
                            fontWeight: 300,
                          }}
                          onClick={() => void regenOne(r.difficulty)}
                        >
                          {copy.neu}
                        </button>
                        <button
                          type="button"
                          className="bg-transparent border-0 cursor-pointer p-0"
                          style={{
                            fontSize: 12,
                            color: "#666",
                            fontWeight: 300,
                          }}
                          onClick={() =>
                            setEditRiddle((prev) => ({
                              ...prev,
                              [r.difficulty]: !editing,
                            }))
                          }
                        >
                          {copy.bearbeiten}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (m.role === "agent" && m.kind === "review_prompt") {
                return (
                  <div
                    key={m.id}
                    className="flex flex-col items-center w-full gap-3"
                  >
                    <button
                      type="button"
                      disabled={saving || loading}
                      className="bg-white cursor-pointer disabled:opacity-50"
                      style={{
                        border: "0.5px solid #e8e8e8",
                        borderRadius: 0,
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "85%",
                      }}
                      onClick={() => void completeSave()}
                    >
                      {copy.looksGood}
                    </button>
                    <button
                      type="button"
                      disabled={loading || saving}
                      className="bg-white cursor-pointer disabled:opacity-50"
                      style={{
                        border: "0.5px solid #e8e8e8",
                        borderRadius: 0,
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "85%",
                      }}
                      onClick={() => void onRegenerateAllRiddles()}
                    >
                      {copy.regenAll}
                    </button>
                  </div>
                );
              }

              if (m.role === "ui" && m.kind === "confirm_bar") {
                return (
                  <div
                    key={m.id}
                    className="flex flex-col items-center w-full gap-3"
                  >
                    <button
                      type="button"
                      disabled={loading}
                      className="bg-white cursor-pointer disabled:opacity-50"
                      style={{
                        border: "0.5px solid #e8e8e8",
                        borderRadius: 0,
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "85%",
                      }}
                      onClick={() => onConfirmJa()}
                    >
                      {copy.ja}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      className="bg-white cursor-pointer disabled:opacity-50"
                      style={{
                        border: "0.5px solid #e8e8e8",
                        borderRadius: 0,
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "85%",
                      }}
                      onClick={() => onConfirmOther()}
                    >
                      {copy.otherBar}
                    </button>
                  </div>
                );
              }

              if (m.role === "ui" && m.kind === "suggestions") {
                if (!suggestionsVisible) return null;
                return (
                  <div
                    key={m.id}
                    className="flex flex-col items-center w-full gap-2"
                  >
                    {m.items.map((item, si) => (
                      <button
                        key={`${m.id}-${si}`}
                        type="button"
                        className="bg-white cursor-pointer text-center"
                        style={{
                          border: "0.5px solid #e8e8e8",
                          borderRadius: 0,
                          padding: "10px 16px",
                          fontSize: 13,
                          fontWeight: 300,
                          color: "#000",
                          maxWidth: "90%",
                        }}
                        onClick={() => {
                          setInput(item);
                          setSuggestionsVisible(false);
                          resizeTextarea();
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                );
              }

              return null;
            })}

            {phase === "search" && searchPanel ? (
              <div className="flex flex-col items-center w-full gap-2">
                {searchPanel.mode === "list" &&
                searchPanel.candidates.length === 0 ? (
                  <p
                    className="text-center"
                    style={{ fontSize: 13, color: "#666", margin: 0 }}
                  >
                    {copy.noHits}
                  </p>
                ) : null}
                {searchPanel.mode === "list"
                  ? searchPanel.candidates.map((c) => (
                      <button
                        key={c.place_id}
                        type="button"
                        disabled={loading}
                        className="bg-white cursor-pointer disabled:opacity-50 text-center w-full"
                        style={{
                          border: "0.5px solid #e8e8e8",
                          borderRadius: 0,
                          padding: "10px 16px",
                          maxWidth: "90%",
                        }}
                        onClick={() => void pickCandidate(c)}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 300,
                            color: "#000",
                            display: "block",
                          }}
                        >
                          {c.name}
                        </span>
                        {c.formatted_address ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 300,
                              color: "#666",
                              display: "block",
                              marginTop: 4,
                            }}
                          >
                            {c.formatted_address}
                          </span>
                        ) : null}
                      </button>
                    ))
                  : null}
                {searchPanel.mode === "single" ? (
                  <button
                    type="button"
                    disabled={loading}
                    className="bg-white cursor-pointer disabled:opacity-50 text-center w-full"
                    style={{
                      border: "0.5px solid #e8e8e8",
                      borderRadius: 0,
                      padding: "10px 16px",
                      maxWidth: "90%",
                    }}
                    onClick={() =>
                      void pickCandidate({
                        place_id: searchPanel.place.place_id,
                        name: searchPanel.place.name,
                        formatted_address: searchPanel.place.formatted_address,
                      })
                    }
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        display: "block",
                      }}
                    >
                      {searchPanel.place.name}
                    </span>
                    {searchPanel.place.formatted_address ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 300,
                          color: "#666",
                          display: "block",
                          marginTop: 4,
                        }}
                      >
                        {searchPanel.place.formatted_address}
                      </span>
                    ) : null}
                  </button>
                ) : null}
              </div>
            ) : null}

            {chipsLoading && phase === "qa" ? (
              <p
                className="text-center"
                style={{ fontSize: 13, color: "#666", margin: 0 }}
              >
                {t("common_loading")}
              </p>
            ) : null}

            {typing ? (
              <div className="flex justify-start gap-0.5" aria-hidden>
                <span className="onb-dot" />
                <span className="onb-dot" />
                <span className="onb-dot" />
              </div>
            ) : null}
          </div>
        </div>

        {phase === "done" ? (
          <div
            className="shrink-0 border-t border-[#e8e8e8]"
            style={{
              borderTopWidth: 0.5,
              padding: "24px 16px 32px",
            }}
          >
            <div
              className="font-mono bg-[#fafafa] w-full"
              style={{
                border: "0.5px solid #e8e8e8",
                fontSize: 12,
                padding: "12px 16px",
                wordBreak: "break-all",
                marginBottom: 16,
              }}
            >
              {TELEGRAM_LINK}
            </div>
            <button
              type="button"
              className="w-full bg-black text-white border-0 cursor-pointer"
              style={{ padding: "14px", fontSize: 14, fontWeight: 300 }}
              onClick={() => {
                router.push("/dashboard");
                router.refresh();
              }}
            >
              {copy.dashboard}
            </button>
          </div>
        ) : (
          <div
            className="shrink-0 bg-white"
            style={{
              borderTop: "0.5px solid #e8e8e8",
              padding: "12px 16px",
            }}
          >
            {err ? (
              <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>
                {err}
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <div
                className="flex-1 flex items-end"
                style={{
                  border: "0.5px solid #000",
                  padding: "10px 14px",
                  display: "flex",
                  minWidth: 0,
                }}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  disabled={inputDisabled}
                  className="flex-1 bg-transparent border-0 outline-none resize-none min-h-[20px] max-h-[160px] disabled:opacity-50"
                  style={{
                    fontSize: 13,
                    fontWeight: 300,
                    fontFamily: "inherit",
                  }}
                  value={input}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInput(v);
                    if (phase === "search") {
                      setQuery(v);
                      if (
                        committedQueryRef.current != null &&
                        v !== committedQueryRef.current
                      ) {
                        committedQueryRef.current = null;
                        setPlace(null);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (phase === "qa" && !inputDisabled) {
                        void handleQaSend(input);
                      }
                    }
                  }}
                  placeholder=""
                />
                {searchBusy && phase === "search" ? (
                  <span style={{ fontSize: 11, color: "#999", marginLeft: 8 }}>
                    {t("common_loading")}
                  </span>
                ) : null}
              </div>
              {showGenButton ? (
                <button
                  type="button"
                  className="shrink-0 bg-transparent border-0 cursor-pointer self-center"
                  style={{
                    fontSize: 12,
                    fontWeight: 300,
                    color: "#000",
                    padding: "4px 8px",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => void onGenerateClick()}
                >
                  {copy.genRiddles}
                </button>
              ) : null}
              <button
                type="button"
                disabled={inputDisabled || phase !== "qa" || !input.trim()}
                className="shrink-0 flex items-center justify-center bg-black text-white border-0 disabled:opacity-40"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  fontSize: 12,
                  fontWeight: 300,
                }}
                aria-label="Send"
                onClick={() => onSendClick()}
              >
                ↑
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes onb-dot-pulse {
          0%,
          60%,
          100% {
            opacity: 0.25;
          }
          30% {
            opacity: 1;
          }
        }
        .onb-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #000;
          animation: onb-dot-pulse 1s ease-in-out infinite;
        }
        .onb-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .onb-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>
    </div>
  );
}
