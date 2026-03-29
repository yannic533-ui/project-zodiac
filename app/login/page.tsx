"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useI18n } from "@/lib/i18n/locale-context";

function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const err = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setFeedback({ kind: "error", text: error.message });
        setLoading(false);
        return;
      }
      setFeedback({ kind: "success", text: t("login_success_email") });
    } catch {
      setFeedback({ kind: "error", text: t("login_error_generic") });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 pr-24 bg-zinc-950">
      <div className="w-full max-w-sm space-y-4 border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-lg text-zinc-200 font-medium">{t("login_title")}</h1>
        <p className="text-sm text-zinc-500">{t("login_subtitle")}</p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login_placeholder_email")}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          {err === "auth" ? (
            <p className="text-sm text-red-400">{t("login_error_auth")}</p>
          ) : null}
          {err === "profile" ? (
            <p className="text-sm text-red-400">{t("login_error_profile")}</p>
          ) : null}
          {feedback ? (
            <p
              className={
                feedback.kind === "success"
                  ? "text-sm text-emerald-400/90"
                  : "text-sm text-red-400"
              }
            >
              {feedback.text}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-amber-600/90 hover:bg-amber-500 text-zinc-950 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? t("common_loading") : t("login_btn_submit")}
          </button>
        </form>
        <p className="text-xs text-zinc-600">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300">
            {t("login_back_home")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm pr-24">
          …
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
