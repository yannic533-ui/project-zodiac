import { createHmac, timingSafeEqual } from "crypto";

export function signAdminSession(adminPassword: string): string {
  return createHmac("sha256", adminPassword)
    .update("schnuffis-admin-session-v1")
    .digest("hex");
}

export function verifyAdminSession(
  cookieValue: string | undefined,
  adminPassword: string | undefined
): boolean {
  if (!cookieValue || !adminPassword) return false;
  const expected = signAdminSession(adminPassword);
  if (cookieValue.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(expected));
  } catch {
    return false;
  }
}

