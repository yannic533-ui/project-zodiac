"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/locale-context";

type BarRow = {
  id: string;
  name: string;
  address: string;
  active: boolean;
};

export default function DashboardOverviewPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [barCount, setBarCount] = useState<number | null>(null);
  const [livePlayerCount, setLivePlayerCount] = useState(0);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [bars, setBars] = useState<BarRow[]>([]);
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [ov, br] = await Promise.all([
        fetch("/api/dashboard/overview", { credentials: "include" }),
        fetch("/api/dashboard/bars", { credentials: "include" }),
      ]);
      if (!ov.ok) {
        if (!cancelled) setLoadFailed(true);
        return;
      }
      const j = (await ov.json()) as {
        barCount: number;
        livePlayerCount: number;
        activeEvent: { name: string } | null;
      };
      if (!cancelled) {
        setLoadFailed(false);
        setBarCount(j.barCount);
        setLivePlayerCount(j.livePlayerCount);
        setActiveName(j.activeEvent?.name ?? null);
      }
      if (br.ok) {
        const bj = (await br.json()) as { bars: BarRow[] };
        if (!cancelled) setBars(bj.bars ?? []);
      }
    }
    void load();
    const timer = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function sendPrompt() {
    const q = promptText.trim();
    setPromptText("");
    if (q) {
      router.push(
        `/dashboard/message?prefill=${encodeURIComponent(q)}`
      );
    }
  }

  const chips =
    locale === "de"
      ? [
          { label: "Event starten", href: "/dashboard/events" },
          { label: "Bar hinzufügen", href: "/dashboard/bars" },
          { label: "Rätsel generieren", href: "/dashboard/riddles" },
          { label: "Live-Status", href: "/dashboard/live" },
        ]
      : [
          { label: "Start event", href: "/dashboard/events" },
          { label: "Add bar", href: "/dashboard/bars" },
          { label: "Generate riddles", href: "/dashboard/riddles" },
          { label: "Live status", href: "/dashboard/live" },
        ];

  return (
    <div className="flex flex-col gap-10">
      {loadFailed ? (
        <p className="swiss-body-sm" style={{ color: "#999" }}>
          {t("dash_over_err")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div
          className="bg-[#fafafa] p-6 swiss-border"
          style={{ padding: 24 }}
        >
          <div className="swiss-label" style={{ fontSize: 10 }}>
            {t("dash_over_bars")}
          </div>
          <div
            className="mt-2 tabular-nums text-black"
            style={{ fontSize: 32, fontWeight: 300 }}
          >
            {barCount === null ? "—" : barCount}
          </div>
          <div className="mt-4 swiss-body-sm" style={{ color: "#cccccc", fontSize: 12 }}>
            <Link href="/dashboard/bars" className="hover:opacity-70" style={{ color: "#cccccc" }}>
              {t("dash_over_manage")}
            </Link>
          </div>
        </div>
        <div className="bg-[#fafafa] swiss-border" style={{ padding: 24 }}>
          <div className="swiss-label" style={{ fontSize: 10 }}>
            {t("dash_over_active_event")}
          </div>
          <div
            className="mt-2 text-black line-clamp-2"
            style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.6 }}
          >
            {activeName ?? t("common_none")}
          </div>
          <div className="mt-4 swiss-body-sm" style={{ color: "#cccccc", fontSize: 12 }}>
            <Link href="/dashboard/events" className="hover:opacity-70" style={{ color: "#cccccc" }}>
              {t("dash_over_events_link")}
            </Link>
          </div>
        </div>
        <div className="bg-[#fafafa] swiss-border" style={{ padding: 24 }}>
          <div className="swiss-label" style={{ fontSize: 10 }}>
            {t("dash_over_live_groups")}
          </div>
          <div
            className="mt-2 tabular-nums text-black"
            style={{ fontSize: 32, fontWeight: 300 }}
          >
            {livePlayerCount}
          </div>
          <div className="mt-4 swiss-body-sm" style={{ color: "#cccccc", fontSize: 12 }}>
            <Link href="/dashboard/live" className="hover:opacity-70" style={{ color: "#cccccc" }}>
              {t("dash_over_live_link")}
            </Link>
          </div>
        </div>
      </div>

      <div className="swiss-border-black">
        <textarea
          className="w-full bg-white resize-none outline-none border-0 swiss-body"
          style={{
            minHeight: 80,
            padding: 16,
            fontSize: 14,
            fontWeight: 300,
          }}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder=""
          aria-label="Prompt"
        />
        <div
          className="flex flex-wrap items-center justify-between gap-4 swiss-border-t bg-white"
          style={{ padding: "10px 16px" }}
        >
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Link
                key={c.href + c.label}
                href={c.href}
                className="inline-block bg-white hover:opacity-80 swiss-border text-black"
                style={{
                  fontSize: 10,
                  padding: "4px 10px",
                  borderRadius: 2,
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => sendPrompt()}
            className="shrink-0 flex items-center justify-center bg-black text-white border-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              fontSize: 14,
              fontWeight: 500,
            }}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>

      <div>
        <p className="swiss-body-sm mb-6" style={{ color: "#999" }}>
          {t("dash_over_onboard_prompt")}{" "}
          <Link href="/onboarding" className="text-black font-medium hover:opacity-70">
            {t("dash_over_onboard_link")}
          </Link>
        </p>

        <div className="swiss-border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="swiss-border-b">
                <th className="swiss-label py-3 px-4 font-medium" style={{ fontSize: 10 }}>
                  {t("dash_bars_name_ph")}
                </th>
                <th className="swiss-label py-3 px-4 font-medium" style={{ fontSize: 10 }}>
                  {t("dash_bars_address_ph")}
                </th>
                <th className="swiss-label py-3 px-4 font-medium" style={{ fontSize: 10 }}>
                  {locale === "de" ? "Status" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody>
              {bars.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-6 px-4 swiss-body-sm"
                    style={{ color: "#999" }}
                  >
                    {t("common_none")}
                  </td>
                </tr>
              ) : (
                bars.map((b) => (
                  <tr key={b.id} className="swiss-border-b">
                    <td className="py-3 px-4 swiss-body-sm text-black">{b.name}</td>
                    <td className="py-3 px-4 swiss-body-sm" style={{ color: "#999" }}>
                      {b.address}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-block swiss-body-sm"
                        style={{
                          padding: "4px 10px",
                          borderRadius: 2,
                          fontSize: 10,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontWeight: 500,
                          backgroundColor: b.active ? "#000000" : "#f0f0f0",
                          color: b.active ? "#ffffff" : "#999999",
                        }}
                      >
                        {b.active ? t("dash_bars_active") : t("dash_bars_inactive")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
