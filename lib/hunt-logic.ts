import { createAdminClient } from "@/lib/supabase/admin";
import { validateRiddleWithClaude } from "@/lib/claude";
import {
  barPointsForSolve,
  computeTimeBonus,
  filterActiveRoute,
  parseLanguageInput,
} from "@/lib/game";
import { sendTelegramMessage } from "@/lib/telegram";
import type { GroupLanguage, GroupRow, GroupState } from "@/lib/types";
import type { TelegramMessage } from "@/lib/telegram";

const CLOSED_DE =
  "Hier ist gerade nichts offen. Wenn eine Jagd läuft, melde ich mich.";
const CLOSED_EN =
  "Nothing is open right now. When a hunt runs, you will hear from me.";

const ASK_LANG = "English or Deutsch?";

function closedMessage(): string {
  return `${CLOSED_DE}\n\n${CLOSED_EN}`;
}

async function loadActiveEvents(): Promise<{ id: string }[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("events")
    .select("id")
    .eq("active", true);
  if (error) throw error;
  return data ?? [];
}

async function loadEventRoute(eventId: string): Promise<string[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("events")
    .select("route")
    .eq("id", eventId)
    .single();
  if (error) throw error;
  const route = (data?.route as string[] | null) ?? [];
  return route;
}

async function loadActiveBarIds(): Promise<Set<string>> {
  const sb = createAdminClient();
  const { data, error } = await sb.from("bars").select("id").eq("active", true);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.id as string));
}

async function loadBar(barId: string) {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("bars")
    .select("*")
    .eq("id", barId)
    .eq("active", true)
    .single();
  if (error) return null;
  return data as {
    id: string;
    name: string;
    address: string;
    prize_description: string;
  };
}

async function loadRiddleForBar(barId: string) {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("riddles")
    .select("*")
    .eq("bar_id", barId)
    .order("difficulty", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    bar_id: string;
    question: string;
    answer_keywords: string[];
    hint_1: string;
    hint_2: string;
  } | null;
}

async function getGroupByChat(chatId: bigint): Promise<GroupRow | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("groups")
    .select("*")
    .eq("telegram_chat_id", chatId.toString())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapGroupRow(data);
}

function mapGroupRow(data: Record<string, unknown>): GroupRow {
  return {
    id: data.id as string,
    event_id: data.event_id as string,
    telegram_chat_id: String(data.telegram_chat_id),
    group_name: (data.group_name as string) ?? "",
    current_bar_index: Number(data.current_bar_index),
    points: Number(data.points),
    state: data.state as GroupRow["state"],
    hint_count: Number(data.hint_count),
    hints_delivered: Number(data.hints_delivered),
    language: (data.language as GroupLanguage | null) ?? null,
    started_at: (data.started_at as string | null) ?? null,
    last_progress_at: (data.last_progress_at as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

async function createGroup(
  eventId: string,
  chatId: bigint,
  title: string
): Promise<GroupRow> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("groups")
    .insert({
      event_id: eventId,
      telegram_chat_id: chatId.toString(),
      group_name: title || "Group",
      state: "waiting" as GroupState,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapGroupRow(data as Record<string, unknown>);
}

async function updateGroup(id: string, patch: Record<string, unknown>) {
  const sb = createAdminClient();
  const { error } = await sb.from("groups").update(patch).eq("id", id);
  if (error) throw error;
}

export async function processHuntMessage(msg: TelegramMessage): Promise<void> {
  const chatId = BigInt(msg.chat.id);
  const text = (msg.text ?? "").trim();
  if (!text) return;

  let group = await getGroupByChat(chatId);

  if (!group) {
    const active = await loadActiveEvents();
    if (active.length !== 1) {
      await sendTelegramMessage(chatId, closedMessage());
      return;
    }
    group = await createGroup(
      active[0].id,
      chatId,
      msg.chat.title ?? "Group"
    );
    const langGuess = parseLanguageInput(text);
    if (!langGuess) {
      await sendTelegramMessage(chatId, ASK_LANG);
      return;
    }
    await updateGroup(group.id, { language: langGuess });
    group = (await getGroupByChat(chatId))!;
    await startRiddleForGroup(group);
    return;
  }

  if (group.state === "waiting") {
    const lang = parseLanguageInput(text);
    if (!lang) {
      await sendTelegramMessage(chatId, ASK_LANG);
      return;
    }
    await updateGroup(group.id, { language: lang });
    const g = (await getGroupByChat(chatId))!;
    await startRiddleForGroup(g);
    return;
  }

  if (group.state === "finished") {
    const lang = group.language ?? "en";
    await sendTelegramMessage(
      chatId,
      lang === "de"
        ? "Die Jagd ist vorbei. Bis zum nächsten Mal."
        : "The hunt is over. Until next time."
    );
    return;
  }

  if (group.state === "travelling") {
    await advanceFromTravelling(group);
    return;
  }

  if (group.state === "riddle") {
    await handleRiddleAnswer(group, text);
  }
}

async function filteredRouteForEvent(eventId: string): Promise<string[]> {
  const route = await loadEventRoute(eventId);
  const activeIds = await loadActiveBarIds();
  return filterActiveRoute(route, activeIds);
}

async function startRiddleForGroup(group: GroupRow) {
  const chatId = BigInt(group.telegram_chat_id);
  const route = await filteredRouteForEvent(group.event_id);
  if (route.length === 0) {
    await sendTelegramMessage(
      chatId,
      group.language === "de"
        ? "Die Route ist leer. Das kann ich nicht spielen."
        : "The route is empty. I cannot run this."
    );
    return;
  }

  const barId = route[group.current_bar_index];
  if (!barId) {
    await sendTelegramMessage(
      chatId,
      group.language === "de"
        ? "Index kaputt. Admin rufen."
        : "Route index broken. Call an admin."
    );
    return;
  }

  const bar = await loadBar(barId);
  if (!bar) {
    await sendTelegramMessage(
      chatId,
      group.language === "de"
        ? "Diese Station existiert nicht mehr."
        : "This stop no longer exists."
    );
    return;
  }

  const riddle = await loadRiddleForBar(barId);
  if (!riddle) {
    await sendTelegramMessage(
      chatId,
      group.language === "de"
        ? "Hier fehlt ein Rätsel. Admin rufen."
        : "No riddle here. Ping an admin."
    );
    return;
  }

  const now = new Date().toISOString();
  await updateGroup(group.id, {
    state: "riddle",
    started_at: group.started_at ?? now,
    last_progress_at: now,
    hint_count: 0,
    hints_delivered: 0,
  });

  const lang = group.language ?? "en";
  const intro =
    lang === "de"
      ? "Gut. Dann legen wir los.\n\n"
      : "Good. Then we begin.\n\n";
  await sendTelegramMessage(chatId, intro + riddle.question);
}

async function handleRiddleAnswer(group: GroupRow, text: string) {
  const chatId = BigInt(group.telegram_chat_id);
  const route = await filteredRouteForEvent(group.event_id);
  const barId = route[group.current_bar_index];
  if (!barId) {
    await sendTelegramMessage(
      chatId,
      "Route error."
    );
    return;
  }

  const bar = await loadBar(barId);
  const riddle = await loadRiddleForBar(barId);
  if (!riddle || !bar) {
    await sendTelegramMessage(chatId, "Missing bar or riddle.");
    return;
  }

  const lang = group.language ?? "en";
  const result = await validateRiddleWithClaude({
    language: lang,
    question: riddle.question,
    answerKeywords: riddle.answer_keywords ?? [],
    userAnswer: text,
  });

  if (result.valid && result.passphrase) {
    const { base, hintPenalty } = barPointsForSolve(group.hints_delivered);
    const started = group.last_progress_at
      ? new Date(group.last_progress_at)
      : null;
    const timeBonus = computeTimeBonus(new Date(), started);
    const delta = base - hintPenalty + timeBonus;

    const sb = createAdminClient();
    await sb.from("passphrases").insert({
      bar_id: bar.id,
      event_id: group.event_id,
      code: result.passphrase,
    });

    await updateGroup(group.id, {
      state: "travelling",
      points: group.points + delta,
      hint_count: 0,
      hints_delivered: 0,
    });

    const prize = bar.prize_description?.trim();
    const addrLine =
      lang === "de"
        ? `Adresse: ${bar.address}`
        : `Address: ${bar.address}`;
    const whisper =
      lang === "de"
        ? `Am Tresen: "${result.passphrase}".`
        : `At the bar: "${result.passphrase}".`;

    let body = `${result.reply}\n\n${whisper}\n${addrLine}`;
    if (prize) body += `\n${prize}`;

    await sendTelegramMessage(chatId, body);
    return;
  }

  const newHintCount = group.hint_count + 1;
  let hintsDelivered = group.hints_delivered;
  const updates: Record<string, unknown> = { hint_count: newHintCount };

  await sendTelegramMessage(chatId, result.reply);

  if (newHintCount === 2 && hintsDelivered < 1 && riddle.hint_1?.trim()) {
    hintsDelivered = 1;
    updates.hints_delivered = hintsDelivered;
    await sendTelegramMessage(chatId, riddle.hint_1.trim());
  } else if (
    newHintCount === 4 &&
    hintsDelivered < 2 &&
    riddle.hint_2?.trim()
  ) {
    hintsDelivered = 2;
    updates.hints_delivered = hintsDelivered;
    await sendTelegramMessage(chatId, riddle.hint_2.trim());
  }

  await updateGroup(group.id, updates);
}

async function advanceFromTravelling(group: GroupRow) {
  const chatId = BigInt(group.telegram_chat_id);
  const route = await filteredRouteForEvent(group.event_id);
  const nextIndex = group.current_bar_index + 1;

  if (nextIndex >= route.length) {
    await updateGroup(group.id, { state: "finished", current_bar_index: nextIndex });
    const lang = group.language ?? "en";
    await sendTelegramMessage(
      chatId,
      lang === "de"
        ? "Letzte Station. Ihr seid durch. Ruhig feiern."
        : "Last stop. You are done. Celebrate quietly."
    );
    return;
  }

  await updateGroup(group.id, { current_bar_index: nextIndex });

  const g = (await getGroupByChat(chatId))!;
  await startRiddleForGroup(g);
}
