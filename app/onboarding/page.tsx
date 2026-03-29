"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlaceDetailsResult } from "@/lib/google-places";
import type { OnboardingQa } from "@/lib/onboarding-context";
import type { OnboardingRiddleDraft } from "@/lib/onboarding-riddles";

const QA_CHIPS: Record<keyof OnboardingQa, string[]> = {
  special: [
    "Live jazz on Thursdays",
    "Best Old Fashioned in the neighborhood",
    "Tiny terrace out back",
  ],
  story: [
    "Named after the landlord’s dog",
    "A former apothecary",
    "Same family for three generations",
  ],
  regulars: [
    "The house red and a plate of cheese",
    "Whatever is on the blackboard",
    "Shot of kirsch before midnight",
  ],
  insider: [
    "Ring the unmarked bell",
    "Ask for the corner table upstairs",
    "They only take cash after 11",
  ],
};

type Candidate = { place_id: string; name: string; formatted_address?: string };

export default function OnboardingPage() {
  const router = useRouter();
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

  const photoUrl = useMemo(() => {
    const ref = place?.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return `/api/places/photo?ref=${encodeURIComponent(ref)}&maxwidth=640`;
  }, [place]);

  async function runSearch() {
    setErr("");
    setCandidates(null);
    setLoading(true);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query }),
      });
      const j = (await res.json()) as
        | { mode: "single"; place: PlaceDetailsResult }
        | { mode: "list"; candidates: Candidate[] }
        | { error?: string };
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Search failed");
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
      setErr("Network error");
    }
    setLoading(false);
  }

  async function pickCandidate(c: Candidate) {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(c.place_id)}`,
        { credentials: "include" }
      );
      const j = (await res.json()) as { place?: PlaceDetailsResult; error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Failed to load place");
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
      setErr("Network error");
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
        setErr(j.error ?? "Generation failed");
        setLoading(false);
        return;
      }
      setRiddles(j.riddles ?? []);
      setStep(3);
    } catch {
      setErr("Network error");
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
        setErr(j.error ?? "Regenerate failed");
        setLoading(false);
        return;
      }
      if (j.riddle) {
        setRiddles((prev) =>
          (prev ?? []).map((r) => (r.difficulty === d ? j.riddle! : r))
        );
      }
    } catch {
      setErr("Network error");
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
        setErr(j.error ?? "Save failed");
        setSaving(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErr("Network error");
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-10">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-medium text-amber-500/90">Add your bar</h1>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Dashboard
          </Link>
        </div>
        <p className="text-sm text-zinc-500">
          Step {step} of 3 — {step === 1 ? "Find your bar" : step === 2 ? "Tell us more" : "Riddles"}
        </p>

        {err ? <p className="text-sm text-red-400">{err}</p> : null}

        {step === 1 ? (
          <div className="space-y-4">
            <label className="block text-sm text-zinc-400">
              Paste your Google Maps link or search your bar name
            </label>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Maps link or bar name"
            />
            <button
              type="button"
              disabled={loading || !query.trim()}
              onClick={() => void runSearch()}
              className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "…" : "Look up"}
            </button>

            {candidates?.length ? (
              <ul className="space-y-2 border border-zinc-800 rounded-lg p-3 bg-zinc-900/40">
                <li className="text-xs text-zinc-500">Pick a match:</li>
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
                <h2 className="text-sm text-zinc-400">Preview</h2>
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
                <label className="block text-xs text-zinc-500">Name</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">Address</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">Description</label>
                <textarea
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[72px]"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">Website</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                />
                <label className="block text-xs text-zinc-500">Phone</label>
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
                {place.types?.length ? (
                  <p className="text-xs text-zinc-500">
                    Categories: {place.types.join(", ")}
                  </p>
                ) : null}
                {place.opening_hours?.weekday_text?.length ? (
                  <div className="text-xs text-zinc-500 space-y-1">
                    <div>Hours</div>
                    <ul>
                      {place.opening_hours.weekday_text.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {place.price_level != null ? (
                  <p className="text-xs text-zinc-500">
                    Price level: {place.price_level} (0–4)
                  </p>
                ) : null}
                <button
                  type="button"
                  className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium"
                  onClick={() => setStep(2)}
                >
                  Continue
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
              ← Back
            </button>
            {(
              [
                ["special", "What makes your bar special?"],
                ["story", "Is there a story behind the name or location?"],
                ["regulars", "What do regulars always order?"],
                ["insider", "What would an insider know that a tourist wouldn’t?"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <label className="text-sm text-zinc-300">{label}</label>
                <textarea
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm min-h-[64px]"
                  value={qa[key] ?? ""}
                  onChange={(e) =>
                    setQa((q) => ({ ...q, [key]: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <div className="flex flex-wrap gap-2">
                  {QA_CHIPS[key].map((chip) => (
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
                {loading ? "…" : "Generate riddles"}
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
              ← Back
            </button>
            {riddles.map((r) => (
              <div
                key={r.difficulty}
                className="border border-zinc-800 rounded-lg p-4 space-y-2 bg-zinc-900/40"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {r.difficulty === 1
                      ? "Easy"
                      : r.difficulty === 2
                        ? "Medium"
                        : "Hard"}
                  </span>
                  <button
                    type="button"
                    disabled={loading}
                    className="text-xs text-amber-500/90"
                    onClick={() => void regenOne(r.difficulty)}
                  >
                    Regenerate
                  </button>
                </div>
                <label className="text-xs text-zinc-500">Question</label>
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
                <label className="text-xs text-zinc-500">Answer keywords (comma-separated)</label>
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
                <label className="text-xs text-zinc-500">Hint 1</label>
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
                <label className="text-xs text-zinc-500">Hint 2</label>
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
              {saving ? "Saving…" : "Looks good — save bar"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
