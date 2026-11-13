import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { env } from "node:process";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 5;
const failedAttempts = new Map<string, { count: number; since: number }>();

export function checkLoginRateLimit(key: string, now = Date.now()): boolean {
  const current = failedAttempts.get(key);
  if (!current || now - current.since >= ATTEMPT_WINDOW_MS) {
    failedAttempts.set(key, { count: 0, since: now });
    return true;
  }
  return current.count < ATTEMPT_LIMIT;
}

export function recordFailedLogin(key: string, now = Date.now()): void {
  const current = failedAttempts.get(key);
  if (!current || now - current.since >= ATTEMPT_WINDOW_MS) {
    failedAttempts.set(key, { count: 1, since: now });
    return;
  }
  current.count += 1;
}

export function clearFailedLogins(key: string): void {
  failedAttempts.delete(key);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = env["ADMIN_PASSWORD_HASH"];
  const match = stored?.match(/^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i);
  if (!match) throw new Error("ADMIN_PASSWORD_HASH is missing or invalid.");

  const [, salt, expectedHex] = match;
  if (!salt || !expectedHex) throw new Error("ADMIN_PASSWORD_HASH is invalid.");
  const actual = (await scrypt(password, Buffer.from(salt, "hex"), 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAdminSession(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = randomBytes(16).toString("base64url");
  const body = `${expiresAt}.${nonce}`;
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifyAdminSession(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expires, nonce, signature, extra] = token.split(".");
  if (!expires || !nonce || !signature || extra) return false;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;
  const expected = sign(`${expires}.${nonce}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `hmp_admin=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function clearedSessionCookie(secure: boolean): string {
  return [
    "hmp_admin=",
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function getSessionToken(cookieHeader: string | undefined): string | undefined {
  const pair = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("hmp_admin="));
  return pair?.slice("hmp_admin=".length);
}

function sign(value: string): string {
  const secret = env["ADMIN_SESSION_SECRET"];
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 bytes.");
  }
  return createHmac("sha256", secret).update(value).digest("base64url");
}
