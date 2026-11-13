import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { env } from "node:process";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkLoginRateLimit,
  clearFailedLogins,
  createAdminSession,
  getSessionToken,
  recordFailedLogin,
  sessionCookie,
  verifyAdminPassword,
  verifyAdminSession,
} from "./auth";

const oldPasswordHash = env["ADMIN_PASSWORD_HASH"];
const oldSessionSecret = env["ADMIN_SESSION_SECRET"];
const testSecret = randomBytes(32).toString("hex");

afterEach(() => {
  if (oldPasswordHash === undefined) delete env["ADMIN_PASSWORD_HASH"];
  else env["ADMIN_PASSWORD_HASH"] = oldPasswordHash;
  if (oldSessionSecret === undefined) delete env["ADMIN_SESSION_SECRET"];
  else env["ADMIN_SESSION_SECRET"] = oldSessionSecret;
});

describe("admin authentication primitives", () => {
  it("verifies the configured scrypt password hash without storing a plain password", async () => {
    const salt = randomBytes(16);
    env["ADMIN_PASSWORD_HASH"] =
      `scrypt$${salt.toString("hex")}$${scryptSync("strong-test-password", salt, 64).toString("hex")}`;

    await expect(verifyAdminPassword("strong-test-password")).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong-password")).resolves.toBe(false);
  });

  it("signs expiring sessions and sets HttpOnly, SameSite cookies", () => {
    env["ADMIN_SESSION_SECRET"] = testSecret;
    const token = createAdminSession();

    expect(verifyAdminSession(token)).toBe(true);
    expect(verifyAdminSession(`${token}x`)).toBe(false);
    expect(getSessionToken(`other=value; hmp_admin=${token}`)).toBe(token);
    expect(sessionCookie(token, true)).toContain("HttpOnly");
    expect(sessionCookie(token, true)).toContain("Secure");
    expect(sessionCookie(token, true)).toContain("SameSite=Strict");
  });

  it("limits repeated failed sign-in attempts", () => {
    const key = `test-${randomBytes(8).toString("hex")}`;
    const now = 1_000_000;

    expect(checkLoginRateLimit(key, now)).toBe(true);
    for (let attempt = 0; attempt < 5; attempt += 1) recordFailedLogin(key, now);
    expect(checkLoginRateLimit(key, now)).toBe(false);
    expect(checkLoginRateLimit(key, now + 15 * 60 * 1000)).toBe(true);
    clearFailedLogins(key);
  });

  it("rejects sessions signed with a different secret", () => {
    env["ADMIN_SESSION_SECRET"] = testSecret;
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const body = `${expiry}.nonce`;
    const token = `${body}.${createHmac("sha256", randomBytes(32)).update(body).digest("base64url")}`;

    expect(verifyAdminSession(token)).toBe(false);
  });
});
