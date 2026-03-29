"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/locale-context";

function MessageForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  useEffect(() => {
    const pre = searchParams.get("prefill");
    if (pre) setText(decodeURIComponent(pre));
  }, [searchParams]);

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
    <div className="max-w-lg space-y-6">
      <p className="swiss-body-sm" style={{ color: "#999999" }}>
        {t("dash_msg_intro")}
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        <div>
          <label className="swiss-label block mb-2" style={{ fontSize: 10 }}>
            {t("dash_msg_chat_ph")}
          </label>
          <input
            className="w-full bg-white swiss-border outline-none swiss-body-sm"
            style={{ padding: "12px 16px" }}
            placeholder=""
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            required
          />
        </div>
        <div
          className="swiss-border-black"
          style={{ padding: "10px 14px" }}
        >
          <label className="swiss-label block mb-2" style={{ fontSize: 10 }}>
            {t("dash_msg_text_ph")}
          </label>
          <textarea
            className="w-full bg-transparent border-0 outline-none resize-none min-h-[100px] swiss-body-sm"
            placeholder=""
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </div>
        {notice ? (
          <p className="swiss-body-sm" style={{ color: "#999999" }}>
            {notice.text}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center justify-center bg-black text-white border-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              fontSize: 14,
              fontWeight: 500,
            }}
            aria-label={t("dash_msg_send")}
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}

export default function DashboardMessagePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<p className="swiss-body-sm" style={{ color: "#999" }}>{t("common_loading")}</p>}>
      <MessageForm />
    </Suspense>
  );
}
