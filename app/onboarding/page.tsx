"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { placePhotoProxyUrl, type PlaceDetailsResult } from "@/lib/google-places";
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

export default function OnboardingPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [place, setPlace] = useState<PlaceDetailsResult | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [qa, setQa] = useState<OnboardingQa>({});
  const [riddles, setRiddles] = useState<OnboardingRiddleDraft[] | null>(null);
  const [saving, setSaving] = useState(false);

  const chips = QA_CHIPS[locale];

  const photoUrl = useMemo(() => {
    const ref = place?.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return placePhotoProxyUrl(ref, 640);
  }, [place]);

  const stepLabel =
    step === 1 ? t("ob_step1_label") : step === 2 ? t("ob_step2_label") : t("ob_step3_label");

  async function runSearch() {
    setErr("");
    setCandidates(null);
    setLoading(true);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query, languageCode: locale }),
      });
      const j = (await res.json()) as
        | { mode: "single"; place: PlaceDetailsResult }
        | { mode: "list"; candidates: Candidate[] }
        | { error?: string };
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? t("ob_err_search"));
        setLoading(false);
        return;
      }
      if ((j as { mode: string }).mode === "single") {
        const p = (j as { place: PlaceDetailsResult }).place;
        setPlace(p);
        setEditName(p.name);
        setEditAddress(p.formatted_address);
        setEditDesc(p.editorial_summary?.overview ?? "");
        setEditWebsite(p.website ?? "");
        setEditPhone(p.formatted_phone_number ?? p.international_phone_number ?? "");
        setCandidates(null);
      } else {
        setCandidates((j as { candidates: Candidate[] }).candidates ?? []);
        setPlace(null);
      }
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
  }

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
        setPlace(j.place);
        setEditName(j.place.name);
        setEditAddress(j.place.formatted_address);
        setEditDesc(j.place.editorial_summary?.overview ?? "");
        setEditWebsite(j.place.website ?? "");
        setEditPhone(
          j.place.formatted_phone_number ?? j.place.international_phone_number ?? ""
        );
        setCandidates(null);
      }
    } catch {
      setErr(t("ob_err_network"));
    }
    setLoading(false);
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
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? t("ob_err_save"));
        setSaving(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-10 pr-20">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-medium text-amber-500/90">{t("ob_title")}</h1>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            {t("ob_dashboard_link")}
          </Link>
        </div>
        <p className="text-sm text-zinc-500">
          {t("ob_step", { step: String(step), label: stepLabel })}
        </p>

        {err ? <p className="text-sm text-red-400">{err}</p> : null}

        {step === 1 ? (
          <div className="space-y-4">
            <label className="block text-sm text-zinc-400">{t("ob_q1_label")}</label>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ob_q1_ph")}
            />
            <button
              type="button"
              disabled={loading || !query.trim()}
              onClick={() => void runSearch()}
              className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? t("common_loading") : t("ob_lookup")}
            </button>

            {candidates?.length ? (
              <ul className="space-y-2 border border-zinc-800 rounded-lg p-3 bg-zinc-900/40">
                <li className="text-xs text-zinc-500">{t("ob_pick_match")}</li>
                {candidates.map((c) => (
                  <li key={c.place_id}>
                    <button
                      type="button"
                      className="text-left w-full text-sm text-amber-500/90 hover:text-amber-400"
                      onClick={() => void pickCandidate(c)}
                    >
                      {c.name}
                      {c.formatted_address ? (
                        <span className="block text-xs text-zinc-500">
                          {c.formatted_address}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {place ? (
              <div className="border border-zinc-800 rounded-lg p-4 space-y-3 bg-zinc-900/40">
                <h2 className="text-sm text-zinc-400">{t("ob_preview")}</h2>
                {photoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- same-origin Places proxy */}
                    <img
                      src={photoUrl}
                      alt=""
                      className="w-full max-h-48 object-cover rounded border border-zinc-800"
                    />
                  </>
                ) : null}
                <label className="block text-xs text-zinc-500">{t("ob_label_name")}</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">{t("ob_label_address")}</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">{t("ob_label_desc")}</label>
                <textarea
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[72px]"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">{t("ob_label_website")}</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">{t("ob_label_phone")}</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
                {place.types?.length ? (
                  <p className="text-xs text-zinc-500">
                    {t("ob_categories")} {place.types.join(", ")}
                  </p>
                ) : null}
                {place.opening_hours?.weekday_text?.length ? (
                  <div className="text-xs text-zinc-500 space-y-1">
                    <div>{t("ob_hours")}</div>
                    <ul>
                      {place.opening_hours.weekday_text.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {place.price_level != null ? (
                  <p className="text-xs text-zinc-500">
                    {t("ob_price_level", { n: place.price_level })}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium"
                  onClick={() => setStep(2)}
                >
                  {t("ob_continue")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-300"
              onClick={() => setStep(1)}
            >
              {t("common_back")}
            </button>
            {QA_KEYS.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <label className="text-sm text-zinc-300">{t(label)}</label>
                <textarea
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm min-h-[64px]"
                  value={qa[key] ?? ""}
                  onChange={(e) =>
                    setQa((q) => ({ ...q, [key]: e.target.value }))
                  }
                  placeholder={t("common_optional")}
                />
                <div className="flex flex-wrap gap-2">
                  {chips[key].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="text-xs px-2 py-1 rounded-full border border-zinc-700 text-zinc-400 hover:border-amber-600/50 hover:text-amber-200/90"
                      onClick={() =>
                        setQa((q) => ({
                          ...q,
                          [key]: [q[key], chip].filter(Boolean).join(" ") || chip,
                        }))
                      }
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading || !place}
                onClick={() => void generatePack()}
                className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? t("common_loading") : t("ob_generate")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 && riddles ? (
          <div className="space-y-6">
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-300"
              onClick={() => setStep(2)}
            >
              {t("common_back")}
            </button>
            {riddles.map((r) => (
              <div
                key={r.difficulty}
                className="border border-zinc-800 rounded-lg p-4 space-y-2 bg-zinc-900/40"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {difficultyLabel(r.difficulty)}
                  </span>
                  <button
                    type="button"
                    disabled={loading}
                    className="text-xs text-amber-500/90"
                    onClick={() => void regenOne(r.difficulty)}
                  >
                    {t("ob_regenerate")}
                  </button>
                </div>
                <label className="text-xs text-zinc-500">{t("ob_label_question")}</label>
                <textarea
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[56px]"
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
                <label className="text-xs text-zinc-500">{t("ob_label_keywords")}</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
                <label className="text-xs text-zinc-500">{t("ob_label_hint1")}</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
                <label className="text-xs text-zinc-500">{t("ob_label_hint2")}</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => void complete()}
              className="rounded bg-emerald-600/90 text-zinc-950 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? t("ob_saving") : t("ob_save")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
