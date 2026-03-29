"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  LOCALE_STORAGE_KEY,
  type Locale,
  type MessageKey,
  translate,
} from "@/lib/i18n/translations";

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "de";
  const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
  return raw === "en" ? "en" : "de";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
      {ready ? <LanguageToggle /> : null}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

function showLanguageToggle(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/onboarding") {
    return true;
  }
  if (pathname.startsWith("/dashboard")) {
    return true;
  }
  return false;
}

function LanguageToggle() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();

  if (!showLanguageToggle(pathname)) {
    return null;
  }

  const btn = (active: boolean, rounded: "l" | "r") => ({
    padding: "6px 12px",
    fontSize: 10,
    fontWeight: active ? 500 : 300,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    backgroundColor: active ? "#000000" : "#f0f0f0",
    color: active ? "#ffffff" : "#999999",
    border: "none",
    cursor: "pointer" as const,
    borderRadius: rounded === "l" ? "2px 0 0 2px" : "0 2px 2px 0",
  });

  return (
    <div
      className="fixed top-3 right-4 z-[100] flex bg-white swiss-border"
      style={{ borderRadius: 2 }}
      role="group"
      aria-label={t("lang_toggle_aria")}
    >
      <button
        type="button"
        onClick={() => setLocale("de")}
        style={btn(locale === "de", "l")}
      >
        DE
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        style={btn(locale === "en", "r")}
      >
        EN
      </button>
    </div>
  );
}
