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
    <div
      className="min-h-screen flex items-center justify-center bg-white text-black px-5"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[360px] space-y-8"
      >
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
          className="text-center text-black"
          style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.02em" }}
        >
          Admin
        </h1>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white swiss-border-black outline-none"
          style={{ padding: "12px 16px", fontSize: 14, fontWeight: 300 }}
          placeholder="Password"
        />
        {error ? (
          <p className="swiss-body-sm text-center" style={{ color: "#999999" }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white border-0 disabled:opacity-50"
          style={{ padding: "14px", fontSize: 14, fontWeight: 500 }}
        >
          {loading ? "…" : "Sign in"}
        </button>
        <p className="text-center swiss-body-sm" style={{ fontSize: 11, color: "#cccccc" }}>
          Super admin?{" "}
          <Link href="/login?next=/admin" className="hover:opacity-70" style={{ color: "#999999" }}>
            Email magic link
          </Link>
        </p>
      </form>
    </div>
  );
}
