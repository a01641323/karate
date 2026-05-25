// GET /api/request/me
//
// Cookie-only endpoint that returns the active draft (request row +
// in-progress bundle, if any) so the wizard can rehydrate on reload.
// Returns 204 if there is no usable cookie / draft.

import { NextRequest, NextResponse } from "next/server";
import { authorizeAccess } from "@/lib/requests";
import { getRequestBundle } from "@/lib/bundle";
import { findByCodeId } from "@/lib/tokens";
import { decodeRequestCookie, REQUEST_COOKIE } from "@/lib/cookie";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const cookieVal = req.cookies.get(REQUEST_COOKIE.name)?.value;
  const decoded = decodeRequestCookie(cookieVal);
  if (!decoded) return new NextResponse(null, { status: 204 });
  const record = await authorizeAccess(decoded.requestId, decoded.accessToken);
  if (!record) {
    // Stale cookie — clear it so the wizard starts fresh next refresh.
    const res = new NextResponse(null, { status: 204 });
    res.cookies.delete(REQUEST_COOKIE.name);
    return res;
  }

  // Live code freshness — same logic as /request/page.tsx hydrate.
  let codeStatus: "active" | "unused" | "dead" | null = null;
  let codeExpiresAt: number | null = null;
  if (record.status === "granted" && record.codeId) {
    const code = await findByCodeId(record.codeId).catch(() => null);
    if (!code) codeStatus = "dead";
    else if (code.status === "revoked") codeStatus = "dead";
    else if (code.status === "unused") { codeStatus = "unused"; codeExpiresAt = code.expiresAt; }
    else if (code.status === "used") {
      codeStatus = code.expiresAt > Date.now() ? "active" : "dead";
      codeExpiresAt = code.expiresAt;
    } else codeStatus = "dead";
  }

  const bundle = await getRequestBundle(record.id);
  return NextResponse.json({
    request: {
      id: record.id,
      email: record.email,
      org: record.org,
      tournamentDate: record.tournamentDate,
      notes: record.notes,
      status: record.status,
      createdAt: record.createdAt,
      submittedAt: record.submittedAt ?? null,
      rejectionReason: record.rejectionReason,
      rawCode: record.status === "granted" ? record.rawCode : null,
      codeStatus,
      codeExpiresAt,
    },
    bundle,
  });
}
