import type { SupabaseClient } from "@supabase/supabase-js";

export async function deactivateAllEvents(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.rpc("deactivate_all_events");
  if (error) throw error;
}

export async function activateEventExclusive(
  sb: SupabaseClient,
  eventId: string
): Promise<void> {
  await deactivateAllEvents(sb);
  const { error } = await sb
    .from("events")
    .update({ active: true })
    .eq("id", eventId);
  if (error) throw error;
}
