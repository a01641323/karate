// 6-digit activation codes + KV-backed claim store.
//
// On disk we only ever store SHA-256(code). The raw code is returned
// once to the granting admin and shown on the requester's pending
// page — never persisted in clear.

import { createHash, randomBytes } from "crypto";
import { kv, keys } from "./kv";

export interface CodeRecord {
  codeId: string;
  requestId: string;
  status: "unused" | "used" | "revoked";
  createdAt: number;
  expiresAt: number;           // 30 days from createdAt by default
  ttlHours: number;            // JWT TTL handed out at activation (default 24)
  machineFingerprint: string | null;
  jti: string | null;
  activatedAt: number | null;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generate6DigitCode(): string {
  while (true) {
    const buf = randomBytes(4);
    const n = buf.readUInt32BE(0);
    const max = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
    if (n < max) return String(n % 1_000_000).padStart(6, "0");
  }
}

export interface MintOpts {
  requestId: string;
  ttlHours?: number;           // session TTL handed out at activation
  validForDays?: number;       // how long the code itself is redeemable
}

export async function mintCode(opts: MintOpts): Promise<{ code: string; record: CodeRecord }> {
  // Loop in case of a (statistically negligible) collision.
  for (let i = 0; i < 5; i++) {
    const code = generate6DigitCode();
    const codeHash = hashCode(code);
    const existing = await kv.get<CodeRecord>(keys.code(codeHash));
    if (existing) continue;
    const record: CodeRecord = {
      codeId: codeHash.slice(0, 16),
      requestId: opts.requestId,
      status: "unused",
      createdAt: Date.now(),
      // Pre-activation window: 30 days to redeem the 6-digit code.
      // On activation, `expiresAt` is *replaced* with
      // `activatedAt + ttlHours*3600*1000` so the post-activation
      // session has its own hard ceiling (rental-style: 48h).
      expiresAt: Date.now() + (opts.validForDays ?? 30) * 24 * 60 * 60 * 1000,
      ttlHours: opts.ttlHours ?? 48,
      machineFingerprint: null,
      jti: null,
      activatedAt: null,
    };
    await kv.set(keys.code(codeHash), record);
    await kv.set(keys.codeById(record.codeId), codeHash);
    await kv.sadd(keys.codesSet, record.codeId);
    return { code, record };
  }
  throw new Error("could not mint a unique code after 5 attempts");
}

export async function findByCode(code: string): Promise<CodeRecord | null> {
  return await kv.get<CodeRecord>(keys.code(hashCode(code)));
}

export async function findByCodeId(codeId: string): Promise<CodeRecord | null> {
  const hash = await kv.get<string>(keys.codeById(codeId));
  if (!hash) return null;
  return await kv.get<CodeRecord>(keys.code(hash));
}

export async function markActivated(codeHash: string, fp: string, jti: string): Promise<void> {
  const cur = await kv.get<CodeRecord>(keys.code(codeHash));
  if (!cur) return;
  // First activation flips expiresAt to the rental deadline; re-
  // activations on the same machine keep the existing deadline (set
  // on the first activation) so the JWT never extends past it.
  const activatedAt = cur.activatedAt ?? Date.now();
  const rentalDeadline = cur.activatedAt
    ? cur.expiresAt
    : activatedAt + cur.ttlHours * 60 * 60 * 1000;
  const next: CodeRecord = {
    ...cur,
    status: "used",
    machineFingerprint: fp,
    jti,
    activatedAt,
    expiresAt: rentalDeadline,
  };
  await kv.set(keys.code(codeHash), next);
}

export async function revokeCode(codeId: string): Promise<boolean> {
  const cur = await findByCodeId(codeId);
  if (!cur) return false;
  const codeHash = await kv.get<string>(keys.codeById(codeId));
  if (!codeHash) return false;
  await kv.set(keys.code(codeHash), { ...cur, status: "revoked" });
  if (cur.jti) await kv.set(keys.jtiRevoked(cur.jti), "1");
  return true;
}

export async function listAllCodes(): Promise<CodeRecord[]> {
  const ids = (await kv.smembers(keys.codesSet)) as string[];
  if (ids.length === 0) return [];
  const rows = await Promise.all(ids.map((id) => findByCodeId(id)));
  return rows
    .filter((r): r is CodeRecord => r !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export { hashCode };
