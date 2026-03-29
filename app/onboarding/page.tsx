"use client";

import type { ChangeEvent, CSSProperties } from "react";
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

function AnimatedAgentText({
  text,
  className,
  style,
  onRevealTick,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  onRevealTick?: () => void;
}) {
  const [visible, setVisible] = useState("");

  useEffect(() => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      setVisible("");
      return;
    }
    setVisible(words[0]);
    onRevealTick?.();
    let i = 1;
    if (i >= words.length) return;
    const id = window.setInterval(() => {
      setVisible(words.slice(0, i + 1).join(" "));
      onRevealTick?.();
      i++;
      if (i >= words.length) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
  }, [text, onRevealTick]);

  return (
    <p className={className} style={style}>
      {visible}
    </p>
  );
}

type OnboardingRespondHistoryItem = {
  role: "user" | "assistant";
  text: string;
};

function placeBarDescription(p: PlaceDetailsResult): string {
  return p.editorial_summary?.overview?.trim() ?? "";
}

function placeBarWebsite(p: PlaceDetailsResult): string {
  return p.website?.trim() ?? "";
}

function chatMessagesToRespondHistory(
  msgs: ChatMessage[]
): OnboardingRespondHistoryItem[] {
  const out: OnboardingRespondHistoryItem[] = [];
  for (const m of msgs) {
    if (m.kind !== "text") continue;
    if (m.role === "user") out.push({ role: "user", text: m.text });
    if (m.role === "agent")
      out.push({ role: "assistant", text: m.text });
  }
  return out;
}

function buildOnboardingRespondSystem(params: {
  barName: string;
  barAddress: string;
  barDescription: string;
  barWebsite: string;
  locale: "de" | "en";
  phase: "confirm" | "qa";
}): string {
  const {
    barName,
    barAddress,
    barDescription,
    barWebsite,
    locale,
    phase,
  } = params;
  const lang = locale === "de" ? "German" : "English";
  const parts = [
    "You help onboard a bar for a trivia/riddle game app.",
    `Bar name: ${barName}`,
    `Address: ${barAddress}`,
    barDescription ? `Description: ${barDescription}` : null,
    barWebsite ? `Website: ${barWebsite}` : null,
    `Locale: ${locale}. Reply only in ${lang}.`,
    phase === "confirm"
      ? `Phase: confirm. The user just confirmed this bar. Send a single opening message: briefly reflect light web research about this venue (atmosphere, what it is known for), then ask what else they want the game to know. Stay concise and warm.`
      : `Phase: qa. Continue naturally from the prior messages. Short follow-up questions are fine. Do not paste the full bar address block again unless needed. One message only.`,
  ];
  return parts.filter(Boolean).join("\n");
}

function buildOnboardingRespondRequestBody(params: {
  place: PlaceDetailsResult;
  locale: "de" | "en";
  phase: "confirm" | "qa";
  message: string;
  history: OnboardingRespondHistoryItem[];
}): { messages: { role: "user" | "assistant"; content: string }[]; system: string } {
  const { place, locale, phase, message, history } = params;
  const system = buildOnboardingRespondSystem({
    barName: place.name,
    barAddress: place.formatted_address ?? "",
    barDescription: placeBarDescription(place),
    barWebsite: placeBarWebsite(place),
    locale,
    phase,
  });
  const prior = history.map((h) => ({
    role: h.role,
    content: h.text,
  }));
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...prior,
    { role: "user", content: message },
  ];
  return { messages, system };
}

async function postOnboardingRespond(
  place: PlaceDetailsResult,
  locale: "de" | "en",
  phase: "confirm" | "qa",
  message: string,
  history: OnboardingRespondHistoryItem[]
): Promise<{ text: string }> {
  const { messages, system } = buildOnboardingRespondRequestBody({
    place,
    locale,
    phase,
    message,
    history,
  });
  const res = await fetch("/api/onboarding/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages, system }),
  });
  const j = (await res.json()) as { text?: string; error?: string };
  if (!res.ok) {
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  if (!j.text?.trim()) {
    throw new Error("Empty response");
  }
  return { text: j.text.trim() };
}

function isDoneMessage(raw: string, locale: "de" | "en"): boolean {
  const t = raw.trim().toLowerCase();
  if (locale === "de") {
    return (
      t === "nein" ||
      t === "reicht" ||
      t === "nichts" ||
      t === "done" ||
      t === "nein." ||
      t === "reicht." ||
      t === "nichts." ||
      t === "done."
    );
  }
  return (
    t === "no" ||
    t === "enough" ||
    t === "nothing" ||
    t === "done" ||
    t === "no." ||
    t === "enough." ||
    t === "nothing." ||
    t === "done."
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
            generatingNow: "Gut. Ich generiere jetzt.",
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
            generatingNow: "Good. I'm generating now.",
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
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seededRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const qaUserSendCountRef = useRef(0);

  const qa: OnboardingQa = useMemo(
    () => buildQaFromNotes(qaNotes),
    [qaNotes]
  );

  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
      );
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  const computeAtBottom = useCallback((el: HTMLDivElement) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const bumpScroll = useCallback(() => {
    requestAnimationFrame(() => scrollToBottom(true));
  }, [scrollToBottom]);

  const appendMessages = useCallback(
    (next: ChatMessage[], fromUser = false) => {
      const el = chatBodyRef.current;
      const shouldScroll = fromUser
        ? !el || computeAtBottom(el)
        : true;
      setMessages((m) => [...m, ...next]);
      requestAnimationFrame(() => {
        if (shouldScroll) scrollToBottom(true);
      });
    },
    [computeAtBottom, scrollToBottom]
  );

  const agentSay = useCallback(
    async (appendFn: () => void, typingDelay = 300) => {
      setTyping(true);
      requestAnimationFrame(() => scrollToBottom(true));
      await delay(typingDelay);
      setTyping(false);
      await delay(50);
      appendFn();
      requestAnimationFrame(() => scrollToBottom(true));
    },
    [scrollToBottom]
  );

  /** Seed opening agent line once */
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void (async () => {
      await agentSay(() => {
        appendMessages(
          [{ id: uid(), role: "agent", kind: "text", text: copy.open }],
          false
        );
      });
      scrollToBottom(false);
    })();
  }, [appendMessages, agentSay, copy.open, scrollToBottom]);

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

  useEffect(() => {
    if (phase !== "search" || !searchPanel) return;
    const el = chatBodyRef.current;
    if (!el || computeAtBottom(el)) scrollToBottom(true);
  }, [searchPanel, phase, computeAtBottom, scrollToBottom]);

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

  const resetTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "24px";
  }, []);

  const handleTextareaInput = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setInput(v);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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
    },
    [phase]
  );

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
      appendMessages(
        [
          { id: uid(), role: "agent", kind: "place_card", place: p },
          { id: uid(), role: "agent", kind: "text", text: copy.confirm },
          { id: uid(), role: "ui", kind: "confirm_bar" },
        ],
        false
      );
      setPhase("confirm_bar");
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
  }

  function onConfirmJa() {
    if (!place) return;
    const p = place;
    setProgressPct(25);
    setQaNotes([]);
    setFirstQaMessageSent(false);
    qaUserSendCountRef.current = 0;
    setInput("");
    resetTextareaHeight();
    setPhase("qa");
    void (async () => {
      setErr("");
      setTyping(true);
      requestAnimationFrame(() => scrollToBottom(true));
      const confirmMessage =
        lc === "de"
          ? "Die Bar-Auswahl ist bestätigt. Sende jetzt deine erste Nachricht."
          : "The bar selection is confirmed. Send your opening message now.";
      try {
        const { text } = await postOnboardingRespond(
          p,
          lc,
          "confirm",
          confirmMessage,
          []
        );
        setTyping(false);
        appendMessages(
          [{ id: uid(), role: "agent", kind: "text", text }],
          false
        );
        requestAnimationFrame(() => scrollToBottom(true));
      } catch {
        setTyping(false);
        setErr(t("ob_err_network"));
        appendMessages(
          [
            {
              id: uid(),
              role: "agent",
              kind: "text",
              text: copy.whatElse(p.name),
            },
          ],
          false
        );
        requestAnimationFrame(() => scrollToBottom(true));
      }
    })();
  }

  useEffect(() => {
    if (phase !== "qa" || !place || chipsLoading) return;
    const items = pickThreeSuggestions(smartChips);
    const hasSuggestions = messagesRef.current.some(
      (m) => m.role === "ui" && m.kind === "suggestions"
    );
    if (items.length === 0 || hasSuggestions) return;
    appendMessages(
      [{ id: uid(), role: "ui", kind: "suggestions", items }],
      false
    );
  }, [phase, place, smartChips, chipsLoading, appendMessages]);

  function onConfirmOther() {
    setPlace(null);
    setPhase("search");
    setSearchPanel(null);
    committedQueryRef.current = null;
    setQuery("");
    setInput("");
    resetTextareaHeight();
    void (async () => {
      await delay(400);
      await agentSay(() =>
        appendMessages(
          [
            {
              id: uid(),
              role: "agent",
              kind: "text",
              text: copy.searchAgain,
            },
          ],
          false
        )
      );
    })();
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
        await agentSay(() =>
          appendMessages(
            [{ id: uid(), role: "agent", kind: "text", text: copy.moment }],
            false
          )
        );
        setTyping(true);
        requestAnimationFrame(() => scrollToBottom(true));
        let res: Response;
        try {
          res = await fetch("/api/onboarding/generate-riddles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ mode: "pack", place, qa }),
          });
        } finally {
          setTyping(false);
        }
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
          requestAnimationFrame(() => scrollToBottom(true));
        }
        setRiddles(pack);
        setProgressPct(75);
        setPhase("review_riddles");
        setEditRiddle({});

        const sorted = [...pack].sort((a, b) => a.difficulty - b.difficulty);
        for (let i = 0; i < sorted.length; i++) {
          if (i > 0) await delay(400);
          await agentSay(() =>
            appendMessages(
              [
                {
                  id: uid(),
                  role: "agent",
                  kind: "riddle",
                  riddle: sorted[i],
                },
              ],
              false
            )
          );
        }

        await delay(400);
        await agentSay(() =>
          appendMessages(
            [
              {
                id: uid(),
                role: "agent",
                kind: "text",
                text: copy.reviewAsk,
              },
            ],
            false
          )
        );
        appendMessages(
          [{ id: uid(), role: "agent", kind: "review_prompt" }],
          false
        );
      } catch {
        setErr(t("ob_err_network"));
        setPhase(opts?.replaceReview ? "review_riddles" : "qa");
      }
      setLoading(false);
    },
    [place, qa, appendMessages, copy, t, agentSay, stripReviewTail, scrollToBottom]
  );

  async function regenOne(d: 1 | 2 | 3) {
    if (!place || !riddles) return;
    setErr("");
    setLoading(true);
    setTyping(true);
    requestAnimationFrame(() => scrollToBottom(true));
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
    } finally {
      setTyping(false);
      setLoading(false);
    }
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
      await delay(400);
      await agentSay(() =>
        appendMessages(
          [
            {
              id: uid(),
              role: "agent",
              kind: "text",
              text: copy.live(place.name),
            },
          ],
          false
        )
      );
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
    if (!place) return;

    const prevHistory = chatMessagesToRespondHistory(messagesRef.current);

    appendMessages(
      [{ id: uid(), role: "user", kind: "text", text: trimmed }],
      true
    );
    setInput("");
    resetTextareaHeight();

    if (!firstQaMessageSent) {
      setFirstQaMessageSent(true);
      setProgressPct(50);
    }

    async function showGutAndGenerate() {
      setQaNotes((n) => [...n, trimmed]);
      appendMessages(
        [
          {
            id: uid(),
            role: "agent",
            kind: "text",
            text: copy.generatingNow,
          },
        ],
        false
      );
      await delay(700);
      await generatePack();
    }

    if (isDoneMessage(trimmed, lc)) {
      await showGutAndGenerate();
      return;
    }

    qaUserSendCountRef.current += 1;
    if (qaUserSendCountRef.current >= 3) {
      await showGutAndGenerate();
      return;
    }

    setQaNotes((n) => [...n, trimmed]);
    setErr("");
    setTyping(true);
    requestAnimationFrame(() => scrollToBottom(true));
    try {
      const { text: reply } = await postOnboardingRespond(
        place,
        lc,
        "qa",
        trimmed,
        prevHistory
      );
      setTyping(false);
      appendMessages(
        [{ id: uid(), role: "agent", kind: "text", text: reply }],
        false
      );
      requestAnimationFrame(() => scrollToBottom(true));
    } catch {
      setTyping(false);
      setErr(t("ob_err_network"));
      appendMessages(
        [{ id: uid(), role: "agent", kind: "text", text: copy.noch }],
        false
      );
      requestAnimationFrame(() => scrollToBottom(true));
    }
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
    saving ||
    (phase === "qa" && typing);

  const showGenButton = phase === "qa" && !loading && !saving;

  function onSendClick() {
    if (phase === "qa") {
      void handleQaSend(input);
    }
  }

  const shellStyle: CSSProperties = {
    height: "calc(var(--vh, 1vh) * 100)",
    maxWidth: 640,
    margin: "0 auto",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    fontWeight: 300,
    fontSize: 15,
    lineHeight: 1.6,
    color: "#000",
    background: "#fff",
  };

  const chatBodyStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    overscrollBehavior: "contain",
    padding: "24px 16px 16px",
    scrollBehavior: "smooth",
    minHeight: 0,
  };

  const inputAreaStyle: CSSProperties = {
    flexShrink: 0,
    borderTop: "0.5px solid #e8e8e8",
    padding: "12px 16px",
    paddingBottom: "max(12px, env(safe-area-inset-bottom))",
    background: "#fff",
  };

  return (
    <div className="onb-shell text-black" style={shellStyle}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          zIndex: 10,
          background: "#e8e8e8",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "#000",
            width: `${progressPct}%`,
            transition: "width 0.6s ease",
          }}
        />
      </div>

      <div ref={chatBodyRef} className="onb-chat-body" style={chatBodyStyle}>
        <div className="flex flex-col" style={{ gap: 12 }}>
            {messages.map((m) => {
              if (m.role === "user" && m.kind === "text") {
                const ut = m.text;
                return (
                  <div key={m.id} className="onb-msg-enter flex justify-end w-full">
                    <div
                      className="max-w-[80%] text-white bg-black"
                      style={{
                        borderRadius: 18,
                        padding: "10px 16px",
                        fontSize: 15,
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
                  <div key={m.id} className="onb-msg-enter flex justify-start w-full">
                    <AnimatedAgentText
                      text={m.text}
                      className="max-w-[80%]"
                      style={{
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "#000",
                        margin: 0,
                      }}
                      onRevealTick={bumpScroll}
                    />
                  </div>
                );
              }

              if (m.role === "agent" && m.kind === "place_card") {
                const src = photoUrl(m.place);
                return (
                  <div key={m.id} className="onb-msg-enter flex justify-start w-full">
                    <div className="max-w-[80%] w-full space-y-2">
                      {src ? (
                        <div
                          className="relative w-full overflow-hidden"
                          style={{ border: "0.5px solid #e8e8e8" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt=""
                            className="w-full max-h-48 object-cover block"
                          />
                          <div
                            className="absolute inset-x-0 bottom-0 left-0 right-0 pointer-events-none"
                            style={{
                              padding: "16px 12px 10px",
                              background:
                                "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)",
                            }}
                          >
                            <p
                              style={{
                                color: "#fff",
                                fontSize: 14,
                                fontWeight: 500,
                                margin: 0,
                                lineHeight: 1.35,
                              }}
                            >
                              {m.place.name}
                            </p>
                            <p
                              style={{
                                color: "rgba(255,255,255,0.7)",
                                fontSize: 11,
                                margin: "4px 0 0",
                                lineHeight: 1.35,
                              }}
                            >
                              {m.place.formatted_address}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p
                            style={{
                              fontSize: 15,
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
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              if (m.role === "agent" && m.kind === "riddle") {
                const r = m.riddle;
                const editing = editRiddle[r.difficulty] ?? false;
                return (
                  <div key={m.id} className="onb-msg-enter flex justify-start w-full">
                    <div className="max-w-[80%] w-full space-y-2">
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
                              fontSize: 16,
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
                              fontSize: 16,
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
                              fontSize: 16,
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
                            fontSize: 15,
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
                            touchAction: "manipulation",
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
                            touchAction: "manipulation",
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
                    className="onb-msg-enter flex flex-col items-center w-full gap-3"
                  >
                    <button
                      type="button"
                      disabled={saving || loading}
                      className="bg-white cursor-pointer disabled:opacity-50"
                      style={{
                        border: "0.5px solid #e8e8e8",
                        borderRadius: 0,
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "80%",
                        touchAction: "manipulation",
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
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "80%",
                        touchAction: "manipulation",
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
                    className="onb-msg-enter flex flex-col items-center w-full gap-3"
                  >
                    <button
                      type="button"
                      disabled={loading}
                      className="bg-white cursor-pointer disabled:opacity-50"
                      style={{
                        border: "0.5px solid #e8e8e8",
                        borderRadius: 0,
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "80%",
                        touchAction: "manipulation",
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
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 300,
                        color: "#000",
                        maxWidth: "80%",
                        touchAction: "manipulation",
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
                    className="onb-msg-enter flex flex-col items-center w-full gap-2"
                  >
                    {m.items.map((item, si) => (
                      <button
                        key={`${m.id}-${si}`}
                        type="button"
                        className="bg-white cursor-pointer text-center"
                        style={{
                          border: "0.5px solid #e8e8e8",
                          borderRadius: 0,
                          padding: "10px 14px",
                          fontSize: 13,
                          fontWeight: 300,
                          color: "#000",
                          maxWidth: "80%",
                          touchAction: "manipulation",
                        }}
                        onClick={() => {
                          setInput(item);
                          setSuggestionsVisible(false);
                          requestAnimationFrame(() => {
                            const el = textareaRef.current;
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                            }
                          });
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
                    className="onb-msg-enter text-center"
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
                        className="onb-msg-enter bg-white cursor-pointer disabled:opacity-50 text-center w-full"
                        style={{
                          border: "0.5px solid #e8e8e8",
                          borderRadius: 0,
                          padding: "10px 14px",
                          maxWidth: "80%",
                          touchAction: "manipulation",
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
                    className="onb-msg-enter bg-white cursor-pointer disabled:opacity-50 text-center w-full"
                    style={{
                      border: "0.5px solid #e8e8e8",
                      borderRadius: 0,
                      padding: "10px 14px",
                      maxWidth: "80%",
                      touchAction: "manipulation",
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

            {typing || (chipsLoading && phase === "qa") ? (
              <div className="flex justify-start gap-1" aria-hidden>
                <span className="onb-typing-dot onb-typing-dot--1" />
                <span className="onb-typing-dot onb-typing-dot--2" />
                <span className="onb-typing-dot onb-typing-dot--3" />
              </div>
            ) : null}
          </div>
        </div>

      {phase === "done" ? (
        <div
          style={{
            ...inputAreaStyle,
            paddingTop: 16,
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
            style={{
              padding: "14px",
              fontSize: 16,
              fontWeight: 300,
              touchAction: "manipulation",
            }}
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          >
            {copy.dashboard}
          </button>
        </div>
      ) : (
        <div style={inputAreaStyle}>
          {err ? (
            <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>
              {err}
            </p>
          ) : null}
          <div
            style={{
              border: "0.5px solid #000",
              padding: "10px 14px",
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              minWidth: 0,
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={inputDisabled}
              className="flex-1 bg-transparent border-0 outline-none resize-none disabled:opacity-50"
              style={{
                fontSize: 16,
                fontWeight: 300,
                fontFamily: "inherit",
                lineHeight: 1.5,
                minHeight: 24,
                maxHeight: 120,
                height: 24,
                overflowY: "auto",
                color: "#000",
              }}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (phase === "qa" && !inputDisabled) {
                    void handleQaSend(input);
                  }
                }
              }}
              placeholder=""
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {searchBusy && phase === "search" ? (
              <span
                style={{
                  fontSize: 12,
                  color: "#999",
                  marginBottom: 4,
                  flexShrink: 0,
                }}
              >
                {t("common_loading")}
              </span>
            ) : null}
            <button
              type="button"
              disabled={inputDisabled || phase !== "qa" || !input.trim()}
              className="flex items-center justify-center bg-black text-white border-0 disabled:opacity-40"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                fontSize: 16,
                fontWeight: 300,
                flexShrink: 0,
                touchAction: "manipulation",
                lineHeight: 1,
              }}
              aria-label="Send"
              onClick={() => onSendClick()}
            >
              ↑
            </button>
          </div>
          {showGenButton ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="bg-transparent border-0 cursor-pointer"
                style={{
                  fontSize: 12,
                  fontWeight: 300,
                  color: "#999",
                  padding: "4px 0",
                  touchAction: "manipulation",
                }}
                onClick={() => void onGenerateClick()}
              >
                {copy.genRiddles}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
