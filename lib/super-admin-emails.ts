export function parseSuperAdminEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS);
  return list.includes(email.trim().toLowerCase());
}
