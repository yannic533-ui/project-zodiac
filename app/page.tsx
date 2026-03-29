"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/locale-context";

export default function Home() {
  const { t, locale } = useI18n();

  const features =
    locale === "de"
      ? [
          "Google Places — Bar in Minuten anlegen",
          "Claude entwirft passende Rätsel",
          "Live-Events für Gruppen über Telegram",
        ]
      : [
          "Onboard your bar with Google Places",
          "Claude drafts riddles that fit your venue",
          "Run live events for groups on Telegram",
        ];

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <header className="relative px-5 md:px-10 pt-10 pb-0">
        <div
          className="font-medium text-black"
          style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          SCHNUFFIS
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-5 md:px-10 py-16">
        <div className="w-full max-w-[640px] mx-auto">
          <h1
            className="text-black"
            style={{
              fontSize: 48,
              fontWeight: 300,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            {t("home_title")}
          </h1>
          <p
            className="mt-8"
            style={{
              fontSize: 16,
              fontWeight: 300,
              lineHeight: 1.6,
              color: "#999999",
            }}
          >
            {t("home_body")}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-black text-white border-0"
              style={{
                padding: "14px 24px",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {t("home_cta_signin")}
            </Link>
            <Link
              href="/login?next=/admin"
              className="inline-flex items-center justify-center bg-white swiss-border text-black"
              style={{
                padding: "14px 24px",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {t("home_cta_admin")}
            </Link>
          </div>

          <ul className="mt-16 space-y-6">
            {features.map((line) => (
              <li
                key={line}
                className="swiss-body-sm text-black"
                style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.6 }}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer
        className="mt-auto px-5 md:px-10 py-8 swiss-border-t"
        style={{ fontSize: 11, color: "#cccccc" }}
      >
        Schnuffis
      </footer>
    </div>
  );
}
