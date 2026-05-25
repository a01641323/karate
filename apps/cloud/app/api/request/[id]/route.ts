// DELETE /api/request/[id]
//
// Wipe a draft request and its bundle. Used by the wizard's
// "empezar de cero" link. Only allowed while the request is still
// a draft (after submit the admin is the only one who can move it).

import { NextRequest, NextResponse } from "next/server";
import { authorizeAccess, deleteRequest } from "@/lib/requests";
import { deleteRequestBundle } from "@/lib/bundle";
import { findByCodeId } from "@/lib/tokens";
import { decodeRequestCookie, REQUEST_COOKIE } from "@/lib/cookie";

export const runtime = "nodejs";

interface RouteContext { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const cookieVal = req.cookies.get(REQUEST_COOKIE.name)?.value;
  const token = decodeRequestCookie(cookieVal)?.accessToken;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const record = await authorizeAccess(id, token);
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Always-OK paths: draft (never submitted) and rejected (admin
  // bounced it). For granted requests we additionally accept the
  // delete when the underlying code is dead (revoked or post-48h) —
  // that's how the wizard's "Solicitar nuevo código" button discards
  // the cookie binding and restarts at step 1.
  const isDraftLike = record.status === "draft" || record.status === "rejected";
  let isDeadGranted = false;
  if (!isDraftLike && record.status === "granted" && record.codeId) {
    const code = await findByCodeId(record.codeId).catch(() => null);
    isDeadGranted = !code
      || code.status === "revoked"
      || (code.status === "used" && code.expiresAt <= Date.now());
  }
  if (!isDraftLike && !isDeadGranted) {
    return NextResponse.json({ error: `cannot_delete_${record.status}` }, { status: 409 });
  }

  await deleteRequestBundle(id);
  await deleteRequest(id);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(REQUEST_COOKIE.name);
  return res;
}
