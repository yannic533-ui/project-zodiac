"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Login failed");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 border border-zinc-800 rounded-lg p-6 bg-zinc-900/50"
      >
        <h1 className="text-lg text-zinc-200 font-medium">Admin</h1>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder="Password"
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-amber-600/90 hover:bg-amber-500 text-zinc-950 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "…" : "Sign in"}
        </button>
        <p className="text-xs text-zinc-500 text-center pt-2">
          Super admin?{" "}
          <Link
            href="/login?next=/admin"
            className="text-amber-500/90 hover:text-amber-400 underline underline-offset-2"
          >
            Email magic link
          </Link>
        </p>
      </form>
    </div>
  );
}
