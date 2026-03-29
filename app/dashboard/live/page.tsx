"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useI18n } from "@/lib/i18n/locale-context";

type LiveRow = {
  id: string;
  event_name: string | null;
  telegram_chat_id: string;
  group_name: string;
  state: string;
  current_bar_index: number;
  current_bar_name: string | null;
  points: number;
  language: string | null;
};

export default function DashboardLivePage() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<LiveRow[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/live", { credentials: "include" });
    if (!res.ok) {
      setLoadFailed(true);
      return;
    }
    const j = (await res.json()) as { groups: LiveRow[] };
    setLoadFailed(false);
    setGroups(j.groups ?? []);
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 4000);
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("dashboard-groups")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => void load()
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <p className="swiss-body-sm max-w-xl" style={{ color: "#999999" }}>
        {t("dash_live_intro")}
      </p>
      {loadFailed ? (
        <p className="swiss-body-sm" style={{ color: "#999999" }}>
          {t("dash_live_err")}
        </p>
      ) : null}
      <div className="swiss-border overflow-x-auto">
        <table className="w-full text-left border-collapse swiss-body-sm">
          <thead>
            <tr className="swiss-border-b bg-[#fafafa]">
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                {t("dash_live_th_group")}
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                {t("dash_live_th_chat")}
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                {t("dash_live_th_event")}
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                {t("dash_live_th_state")}
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                {t("dash_live_th_bar")}
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                {t("dash_live_th_pts")}
              </th>
              <th className="swiss-label py-3 px-3 font-medium" style={{ fontSize: 10 }}>
                {t("dash_live_th_lang")}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 px-3" style={{ color: "#999999" }}>
                  {t("dash_live_empty")}
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="swiss-border-b">
                  <td className="py-3 px-3 text-black">{g.group_name}</td>
                  <td className="py-3 px-3 font-mono" style={{ color: "#999999", fontSize: 12 }}>
                    {g.telegram_chat_id}
                  </td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.event_name ?? "—"}
                  </td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.state}
                  </td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.current_bar_name ?? `#${g.current_bar_index}`}
                  </td>
                  <td className="py-3 px-3 text-black tabular-nums">{g.points}</td>
                  <td className="py-3 px-3" style={{ color: "#999999" }}>
                    {g.language ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
