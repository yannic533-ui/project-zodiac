export const ADMIN_COOKIE = "schnuffis_admin";

export function getAdminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}
