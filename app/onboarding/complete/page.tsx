"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingQa } from "@/lib/onboarding-context";
import type { PlaceDetailsResult } from "@/lib/google-places";
import type { OnboardingRiddleDraft } from "@/lib/onboarding-riddles";

const STORAGE_KEY = "schnuffis_pending_onboarding";

type PendingPlace = {
  name: string;
  address: string;
  description: string;
  website: string;
  placeId: string;
  photoUrl: string;
};

type PendingPayload = {
  place: PendingPlace;
  riddles: OnboardingRiddleDraft[];
  locale: "de" | "en";
  qa?: OnboardingQa;
};

function pendingToPlaceDetails(p: PendingPlace): PlaceDetailsResult {
  return {
    place_id: p.placeId,
    name: p.name,
    formatted_address: p.address,
    website: p.website || undefined,
    editorial_summary: p.description
      ? { overview: p.description }
      : undefined,
  };
}

function parsePending(raw: string): PendingPayload | null {
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    const place = o.place as PendingPlace | undefined;
    const riddles = o.riddles as OnboardingRiddleDraft[] | undefined;
    const locale = o.locale === "en" ? "en" : "de";
    if (
      !place?.placeId ||
      !place.name ||
      typeof place.address !== "string" ||
      !Array.isArray(riddles) ||
      riddles.length === 0
    ) {
      return null;
    }
    return {
      place: {
        name: place.name,
        address: place.address,
        description:
          typeof place.description === "string" ? place.description : "",
        website: typeof place.website === "string" ? place.website : "",
        placeId: place.placeId,
        photoUrl: typeof place.photoUrl === "string" ? place.photoUrl : "",
      },
      riddles,
      locale,
      qa: (o.qa as OnboardingQa) ?? {},
    };
  } catch {
    return null;
  }
}

const TELEGRAM_LINK =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK ?? "https://t.me/";

type CompleteResult =
  | { kind: "redirect" }
  | { kind: "done"; barName: string; locale: "de" | "en" }
  | { kind: "error"; message: string; locale: "de" | "en" };

let completePipeline: Promise<CompleteResult> | null = null;

function runOnboardingCompletePipeline(): Promise<CompleteResult> {
  if (completePipeline) return completePipeline;
  completePipeline = (async (): Promise<CompleteResult> => {
    try {
      if (typeof window === "undefined") return { kind: "redirect" };
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return { kind: "redirect" };

      const pending = parsePending(raw);
      if (!pending) {
        sessionStorage.removeItem(STORAGE_KEY);
        return { kind: "redirect" };
      }

      const place = pendingToPlaceDetails(pending.place);
      const qa = pending.qa ?? {};

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          place,
          qa,
          name: place.name,
          address: place.formatted_address,
          riddles: pending.riddles,
        }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        return {
          kind: "error",
          message: j.error ?? `HTTP ${res.status}`,
          locale: pending.locale,
        };
      }
      sessionStorage.removeItem(STORAGE_KEY);
      return {
        kind: "done",
        barName: place.name,
        locale: pending.locale,
      };
    } catch {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const pending = raw ? parsePending(raw) : null;
      return {
        kind: "error",
        message: "Network error",
        locale: pending?.locale ?? "de",
      };
    } finally {
      completePipeline = null;
    }
  })();
  return completePipeline;
}

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "done" | "error">(
    "loading"
  );
  const [errMsg, setErrMsg] = useState("");
  const [barName, setBarName] = useState("");
  const [uiLocale, setUiLocale] = useState<"de" | "en">("de");

  useEffect(() => {
    let cancelled = false;
    void runOnboardingCompletePipeline().then((result) => {
      if (cancelled) return;
      if (result.kind === "redirect") {
        router.replace("/dashboard");
        return;
      }
      if (result.kind === "error") {
        setUiLocale(result.locale);
        setErrMsg(result.message);
        setStatus("error");
        return;
      }
      setUiLocale(result.locale);
      setBarName(result.barName);
      setStatus("done");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <div
        className="min-h-screen bg-white text-black flex items-center justify-center px-5"
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <p style={{ fontSize: 14, fontWeight: 300, color: "#666" }}>
          …
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="min-h-screen bg-white text-black flex flex-col items-center justify-center px-5"
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <p style={{ fontSize: 14, fontWeight: 300, color: "#999", textAlign: "center", maxWidth: 360 }}>
          {errMsg}
        </p>
        <button
          type="button"
          className="mt-8 bg-black text-white border-0 cursor-pointer"
          style={{ padding: "12px 20px", fontSize: 14, fontWeight: 300 }}
          onClick={() => router.push("/onboarding")}
        >
          {uiLocale === "de" ? "Zurück" : "Back"}
        </button>
      </div>
    );
  }

  const liveLine =
    uiLocale === "de"
      ? barName
        ? `${barName} ist live.`
        : "Bar ist live."
      : barName
        ? `${barName} is live.`
        : "Your bar is live.";

  return (
    <div
      className="min-h-screen bg-white text-black flex flex-col items-center justify-center px-5"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <div className="w-full max-w-[400px] space-y-8 text-center">
        <p style={{ fontSize: 18, fontWeight: 300, lineHeight: 1.5 }}>
          {liveLine}
        </p>
        <div
          className="font-mono bg-[#fafafa] w-full text-left"
          style={{
            border: "0.5px solid #e8e8e8",
            fontSize: 12,
            padding: "12px 16px",
            wordBreak: "break-all",
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
          {uiLocale === "de" ? "Zum Dashboard" : "Go to dashboard"}
        </button>
      </div>
    </div>
  );
}
