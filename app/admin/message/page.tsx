"use client";

import { useState } from "react";

export default function AdminMessagePage() {
  const [telegram_chat_id, setChat] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const res = await fetch("/api/admin/message", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_chat_id, text }),
    });
    if (res.ok) {
      setStatus("Sent.");
      setText("");
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus(j.error ?? "Failed");
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl text-zinc-100 font-medium">Manual message</h1>
      <p className="text-sm text-zinc-500">
        Send any text to a Telegram chat the bot is in. Use the numeric chat ID
        (negative for groups).
      </p>
      <form onSubmit={send} className="space-y-3">
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono"
          placeholder="telegram_chat_id"
          value={telegram_chat_id}
          onChange={(e) => setChat(e.target.value)}
          required
        />
        <textarea
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[120px]"
          placeholder="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        {status ? (
          <p className="text-sm text-zinc-400">{status}</p>
        ) : null}
        <button
          type="submit"
          className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium"
        >
          Send
        </button>
      </form>
    </div>
  );
}
