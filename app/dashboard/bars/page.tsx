"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/locale-context";

type Bar = {
  id: string;
  name: string;
  address: string;
  active: boolean;
  prize_description: string;
};

const inputClass =
  "w-full bg-white swiss-border outline-none swiss-body-sm text-black";
const inputPad = { padding: "12px 16px" as const };

export default function DashboardBarsPage() {
  const { t } = useI18n();
  const [bars, setBars] = useState<Bar[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [prize, setPrize] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/bars", { credentials: "include" });
    if (!res.ok) return;
    const j = (await res.json()) as { bars: Bar[] };
    setBars(j.bars ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addBar(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/dashboard/bars", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, prize_description: prize }),
    });
    if (!res.ok) {
      setMsg(t("dash_bars_fail_create"));
      return;
    }
    setName("");
    setAddress("");
    setPrize("");
    await load();
  }

  async function toggleActive(b: Bar) {
    await fetch(`/api/dashboard/bars?id=${encodeURIComponent(b.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !b.active }),
    });
    await load();
  }

  async function removeBar(id: string) {
    if (!confirm(t("dash_bars_confirm_delete"))) return;
    await fetch(`/api/dashboard/bars?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  }

  return (
    <div className="space-y-10">
      <form onSubmit={addBar} className="space-y-6 max-w-lg swiss-border bg-[#fafafa]" style={{ padding: 24 }}>
        <h2 className="swiss-label" style={{ fontSize: 10 }}>
          {t("dash_bars_add_title")}
        </h2>
        <input
          className={inputClass}
          style={inputPad}
          placeholder={t("dash_bars_name_ph")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className={inputClass}
          style={inputPad}
          placeholder={t("dash_bars_address_ph")}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <textarea
          className={`${inputClass} min-h-[72px]`}
          style={inputPad}
          placeholder={t("dash_bars_prize_ph")}
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
        />
        {msg ? (
          <p className="swiss-body-sm" style={{ color: "#999999" }}>
            {msg}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full bg-black text-white border-0"
          style={{ padding: "14px", fontSize: 14, fontWeight: 500 }}
        >
          {t("dash_bars_add_btn")}
        </button>
      </form>

      <div className="swiss-border overflow-x-auto max-w-4xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="swiss-border-b">
              <th className="swiss-label py-3 px-4 font-medium" style={{ fontSize: 10 }}>
                {t("dash_bars_name_ph")}
              </th>
              <th className="swiss-label py-3 px-4 font-medium" style={{ fontSize: 10 }}>
                {t("dash_bars_address_ph")}
              </th>
              <th className="swiss-label py-3 px-4 font-medium" style={{ fontSize: 10 }}>
                Status
              </th>
              <th className="swiss-label py-3 px-4 font-medium" style={{ fontSize: 10 }} />
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.id} className="swiss-border-b">
                <td className="py-3 px-4 swiss-body-sm text-black">{b.name}</td>
                <td className="py-3 px-4 swiss-body-sm" style={{ color: "#999999" }}>
                  {b.address}
                </td>
                <td className="py-3 px-4">
                  <span
                    className="inline-block"
                    style={{
                      padding: "4px 10px",
                      borderRadius: 2,
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      backgroundColor: b.active ? "#000000" : "#f0f0f0",
                      color: b.active ? "#ffffff" : "#999999",
                    }}
                  >
                    {b.active ? t("dash_bars_active") : t("dash_bars_inactive")}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    className="bg-transparent border-0 swiss-body-sm mr-4 hover:opacity-70"
                    style={{ color: "#999999", fontSize: 11 }}
                    onClick={() => void toggleActive(b)}
                  >
                    {t("dash_bars_toggle")}
                  </button>
                  <button
                    type="button"
                    className="bg-transparent border-0 swiss-body-sm hover:opacity-70"
                    style={{ color: "#999999", fontSize: 11 }}
                    onClick={() => void removeBar(b.id)}
                  >
                    {t("dash_bars_delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
