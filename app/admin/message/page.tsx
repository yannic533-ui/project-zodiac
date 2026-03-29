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
      <p className="swiss-body-sm" style={{ color: "#999999" }}>
        Send any text to a Telegram chat the bot is in. Use the numeric chat ID
        (negative for groups).
      </p>
      <form onSubmit={send} className="space-y-6">
        <input
          className="w-full bg-white swiss-border outline-none font-mono swiss-body-sm"
          style={{ padding: "12px 16px" }}
          placeholder="telegram_chat_id"
          value={telegram_chat_id}
          onChange={(e) => setChat(e.target.value)}
          required
        />
        <textarea
          className="w-full bg-white swiss-border outline-none swiss-body-sm min-h-[120px]"
          style={{ padding: "12px 16px" }}
          placeholder="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        {status ? (
          <p className="swiss-body-sm" style={{ color: "#999999" }}>
            {status}
          </p>
        ) : null}
        <button
          type="submit"
          className="bg-black text-white border-0"
          style={{ padding: "14px 24px", fontSize: 14, fontWeight: 500 }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
