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

  return (
    <div
      className="fixed top-3 right-4 z-[100] flex rounded-md border border-zinc-700 bg-zinc-900/95 backdrop-blur text-xs shadow-lg"
      role="group"
      aria-label={t("lang_toggle_aria")}
    >
      <button
        type="button"
        onClick={() => setLocale("de")}
        className={
          locale === "de"
            ? "px-2.5 py-1.5 rounded-l-md bg-amber-600/90 text-zinc-950 font-medium"
            : "px-2.5 py-1.5 rounded-l-md text-zinc-400 hover:text-zinc-200"
        }
      >
        DE
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={
          locale === "en"
            ? "px-2.5 py-1.5 rounded-r-md bg-amber-600/90 text-zinc-950 font-medium"
            : "px-2.5 py-1.5 rounded-r-md text-zinc-400 hover:text-zinc-200"
        }
      >
        EN
      </button>
    </div>
  );
}
