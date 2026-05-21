// Token-request lifecycle. KV-backed.

import { createHash, randomBytes, randomUUID } from "crypto";
import { kv, keys } from "./kv";

export type RequestStatus = "pending" | "granted" | "rejected";

export interface TokenRequest {
  id: string;
  email: string;
  org: string | null;
  tournamentDate: string | null;
  notes: string | null;
  status: RequestStatus;
  createdAt: number;
  accessTokenHash: string;   // SHA-256 of the accessToken handed back to the requester
  codeId: string | null;     // populated once granted
  // Raw 6-digit code, stored ONLY here so the requester's pending
  // page can show it. This row is access-gated by the cookie/key
  // pair (see authorizeAccess). The general code store keeps only
  // SHA-256 hashes.
  rawCode: string | null;
  reviewedAt: number | null;
  rejectionReason: string | null;
}

function hashAccess(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreateInput {
  email: string;
  org?: string;
  tournamentDate?: string;
  notes?: string;
}

export async function createRequest(
  input: CreateInput,
): Promise<{ id: string; accessToken: string; record: TokenRequest }> {
  const id = randomUUID();
  const accessToken = randomBytes(24).toString("base64url");
  const record: TokenRequest = {
    id,
    email: input.email.trim().toLowerCase(),
    org: input.org?.trim() || null,
    tournamentDate: input.tournamentDate?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "pending",
    createdAt: Date.now(),
    accessTokenHash: hashAccess(accessToken),
    codeId: null,
    rawCode: null,
    reviewedAt: null,
    rejectionReason: null,
  };
  await kv.set(keys.request(id), record);
  await kv.sadd(keys.pendingSet, id);
  return { id, accessToken, record };
}

export async function getRequest(id: string): Promise<TokenRequest | null> {
  return await kv.get<TokenRequest>(keys.request(id));
}

export async function authorizeAccess(
  id: string,
  accessToken: string,
): Promise<TokenRequest | null> {
  const req = await getRequest(id);
  if (!req) return null;
  if (req.accessTokenHash !== hashAccess(accessToken)) return null;
  return req;
}

export async function listPending(): Promise<TokenRequest[]> {
  const ids = (await kv.smembers(keys.pendingSet)) as string[];
  if (ids.length === 0) return [];
  const rows = await Promise.all(ids.map((id) => kv.get<TokenRequest>(keys.request(id))));
  return rows.filter((r): r is TokenRequest => r !== null).sort((a, b) => a.createdAt - b.createdAt);
}

export async function markGranted(
  id: string,
  codeId: string,
  rawCode: string,
): Promise<TokenRequest | null> {
  const cur = await getRequest(id);
  if (!cur || cur.status !== "pending") return null;
  const next: TokenRequest = {
    ...cur,
    status: "granted",
    codeId,
    rawCode,
    reviewedAt: Date.now(),
  };
  await kv.set(keys.request(id), next);
  await kv.srem(keys.pendingSet, id);
  return next;
}

export async function markRejected(id: string, reason?: string): Promise<TokenRequest | null> {
  const cur = await getRequest(id);
  if (!cur || cur.status !== "pending") return null;
  const next: TokenRequest = {
    ...cur,
    status: "rejected",
    reviewedAt: Date.now(),
    rejectionReason: reason ?? null,
  };
  await kv.set(keys.request(id), next);
  await kv.srem(keys.pendingSet, id);
  return next;
}
