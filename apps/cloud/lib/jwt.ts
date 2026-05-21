// EdDSA JWT signing. The local app verifies the resulting tokens with
// the public-key counterpart embedded at compile time.
//
// Claim shape MUST stay backwards-compatible with the previous local
// /api/activate response so the renderer (apps/web) keeps working
// unchanged.

import { SignJWT, type JWTPayload } from "jose";
import { randomUUID } from "crypto";
import { getPrivateKey } from "./keys";

const ISSUER = "https://api.karate-tournament.app";
const AUDIENCE = "karate-tournament-app";

export interface LicenseClaims extends JWTPayload {
  sub: string;
  role: "referee" | "superadmin";
  features: string[];
  plan: string;
  machine_fp: string;
  activated_at: number;
  jti: string;
}

export interface SignArgs {
  codeId: string;
  machineFingerprint: string;
  ttlSeconds: number;
  role?: "referee" | "superadmin";
  features?: string[];
  plan?: string;
  activatedAt?: number;
}

export async function signLicenseJwt(args: SignArgs): Promise<{ token: string; claims: LicenseClaims }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + args.ttlSeconds;
  const jti = randomUUID();
  const claims: LicenseClaims = {
    sub: args.codeId,
    role: args.role ?? "referee",
    features: args.features ?? ["scoring", "public_display", "bracket_view"],
    plan: args.plan ?? "tournament_day",
    machine_fp: args.machineFingerprint,
    activated_at: args.activatedAt ?? now,
    iat: now,
    exp,
    jti,
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(await getPrivateKey());
  return { token, claims };
}
