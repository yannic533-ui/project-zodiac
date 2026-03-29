"use client";

import { useState } from "react";

export default function DashboardMessagePage() {
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/dashboard/message", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_chat_id: chatId.trim(), text: text.trim() }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(j.error ?? "Failed to send");
      return;
    }
    setMsg("Sent.");
    setText("");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl text-zinc-100 font-medium">Send message</h1>
      <p className="text-sm text-zinc-500">
        Message a Telegram group that is playing one of your events (use their
        chat ID).
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder="Telegram chat ID"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          required
        />
        <textarea
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[100px] text-zinc-100"
          placeholder="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        {msg ? (
          <p
            className={
              msg === "Sent." ? "text-sm text-emerald-400" : "text-sm text-red-400"
            }
          >
            {msg}
          </p>
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
