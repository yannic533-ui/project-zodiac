/**
 * Edge-safe HMAC verification (matches Node signAdminSession in admin-auth.ts).
 */
function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signAdminSessionEdge(adminPassword: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(adminPassword),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode("schnuffis-admin-session-v1")
  );
  return hexFromBuffer(sig);
}

export async function verifyAdminSessionEdge(
  cookieValue: string | undefined,
  adminPassword: string | undefined
): Promise<boolean> {
  if (!cookieValue || !adminPassword) return false;
  const expected = await signAdminSessionEdge(adminPassword);
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
