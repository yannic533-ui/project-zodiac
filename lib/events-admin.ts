import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sets every event inactive. Uses a PostgREST filter (not RPC) so it works
 * without the `deactivate_all_events()` DB function and avoids RPC/GRANT issues.
 */
export async function deactivateAllEvents(sb: SupabaseClient): Promise<void> {
  const { error } = await sb
    .from("events")
    .update({ active: false })
    .not("id", "is", null);
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
