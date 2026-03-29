"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/locale-context";

export default function DashboardMessagePage() {
  const { t } = useI18n();
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const res = await fetch("/api/dashboard/message", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_chat_id: chatId.trim(), text: text.trim() }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setNotice({ kind: "err", text: j.error ?? t("dash_msg_fail") });
      return;
    }
    setNotice({ kind: "ok", text: t("dash_msg_sent") });
    setText("");
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl text-zinc-100 font-medium">{t("dash_msg_title")}</h1>
      <p className="text-sm text-zinc-500">{t("dash_msg_intro")}</p>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          placeholder={t("dash_msg_chat_ph")}
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          required
        />
        <textarea
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm min-h-[100px] text-zinc-100"
          placeholder={t("dash_msg_text_ph")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        {notice ? (
          <p
            className={
              notice.kind === "ok"
                ? "text-sm text-emerald-400"
                : "text-sm text-red-400"
            }
          >
            {notice.text}
          </p>
        ) : null}
        <button
          type="submit"
          className="rounded bg-amber-600/90 text-zinc-950 px-4 py-2 text-sm font-medium"
        >
          {t("dash_msg_send")}
        </button>
      </form>
    </div>
  );
}
