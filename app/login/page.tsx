"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const err = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
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
        setMessage(error.message);
        setLoading(false);
        return;
      }
      setMessage("Check your email for the sign-in link.");
    } catch {
      setMessage("Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <div className="w-full max-w-sm space-y-4 border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-lg text-zinc-200 font-medium">Sign in</h1>
        <p className="text-sm text-zinc-500">
          We will email you a magic link. No password.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          {err === "auth" ? (
            <p className="text-sm text-red-400">Sign-in failed. Try again.</p>
          ) : null}
          {err === "profile" ? (
            <p className="text-sm text-red-400">
              Could not set up your profile. Contact support.
            </p>
          ) : null}
          {message ? (
            <p
              className={
                message.startsWith("Check")
                  ? "text-sm text-emerald-400/90"
                  : "text-sm text-red-400"
              }
            >
              {message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-amber-600/90 hover:bg-amber-500 text-zinc-950 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "…" : "Email me a link"}
          </button>
        </form>
        <p className="text-xs text-zinc-600">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300">
            Back to home
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
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
