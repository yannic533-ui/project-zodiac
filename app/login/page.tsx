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
    <div
      className="min-h-screen flex items-center justify-center bg-white text-black px-5"
      style={{ paddingLeft: 20, paddingRight: 20 }}
    >
      <div className="w-full max-w-[360px] space-y-10">
        <div
          className="font-medium text-center"
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 48,
          }}
        >
          SCHNUFFIS
        </div>
        <h1
          className="text-black text-center"
          style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.02em" }}
        >
          {t("login_title")}
        </h1>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login_placeholder_email")}
            className="w-full bg-white swiss-border-black outline-none"
            style={{
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 300,
            }}
          />
          {err === "auth" ? (
            <p className="swiss-body-sm" style={{ color: "#999999" }}>
              {t("login_error_auth")}
            </p>
          ) : null}
          {err === "profile" ? (
            <p className="swiss-body-sm" style={{ color: "#999999" }}>
              {t("login_error_profile")}
            </p>
          ) : null}
          {feedback ? (
            <p
              className="swiss-body-sm"
              style={{
                color: "#999999",
                fontWeight: feedback.kind === "success" ? 500 : 300,
              }}
            >
              {feedback.text}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white border-0 disabled:opacity-50"
            style={{ padding: "14px", fontSize: 14, fontWeight: 500 }}
          >
            {loading ? t("common_loading") : t("login_btn_submit")}
          </button>
        </form>
        <p className="text-center swiss-body-sm" style={{ color: "#cccccc", fontSize: 11 }}>
          <Link href="/" className="hover:opacity-70" style={{ color: "#999999" }}>
            {t("login_back_home")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center bg-white text-black swiss-body-sm"
          style={{ color: "#999999" }}
        >
          {t("common_loading")}
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
