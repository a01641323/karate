// Signed httpOnly cookie for the public-request flow. Carries
// { requestId, accessToken } so a visitor's pending page stays bound
// to their request across refreshes and across tabs.
//
// We sign with HMAC-SHA256 keyed by COOKIE_SECRET. Tampering is
// detected at verify time.

import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "karate.request";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days, well past the 30-day code expiry

interface RequestCookiePayload {
  requestId: string;
  accessToken: string;
}

function secret(): string {
  const s = process.env.COOKIE_SECRET;
  if (!s) throw new Error("COOKIE_SECRET is not set");
  return s;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeRequestCookie(payload: RequestCookiePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeRequestCookie(raw: string | undefined | null): RequestCookiePayload | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch { return null; }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as RequestCookiePayload;
  } catch { return null; }
}

export const REQUEST_COOKIE = {
  name: COOKIE_NAME,
  maxAge: COOKIE_MAX_AGE,
};
