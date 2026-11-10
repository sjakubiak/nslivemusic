import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * One admin, one password (ADMIN_PASSWORD on Render). The cookie holds an
 * HMAC of the password, so changing the password logs everyone out. With no
 * password set, the admin pages stay locked.
 */
export const ADMIN_COOKIE = "ns_admin";

export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return crypto.createHmac("sha256", pw).update("nslivemusic-admin-v1").digest("hex");
}

export function passwordMatches(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || !got || got.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(token));
}
