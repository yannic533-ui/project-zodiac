import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin-emails";

export type ProfileRole = "super_admin" | "bar_owner" | "player";

export async function syncUserProfileFromEmail(params: {
  userId: string;
  email: string | undefined | null;
}): Promise<{ role: ProfileRole }> {
  const email = params.email?.trim() ?? "";
  const role: ProfileRole = isSuperAdminEmail(email)
    ? "super_admin"
    : "bar_owner";

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").upsert(
    { id: params.userId, role },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[profile-sync] upsert failed", error);
    throw error;
  }

  return { role };
}
