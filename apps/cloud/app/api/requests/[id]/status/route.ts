import { NextRequest, NextResponse } from "next/server";
import { authorizeAccess } from "@/lib/requests";
import { findByCodeId } from "@/lib/tokens";
import { decodeRequestCookie, REQUEST_COOKIE } from "@/lib/cookie";

export const runtime = "nodejs";

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  // Authorization: prefer ?key= for cross-device recovery, fall back to the cookie.
  const keyParam = req.nextUrl.searchParams.get("key");
  const cookieVal = req.cookies.get(REQUEST_COOKIE.name)?.value;
  const accessToken = keyParam ?? decodeRequestCookie(cookieVal)?.accessToken;

  if (!accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const record = await authorizeAccess(id, accessToken);
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (record.status !== "granted") {
    return NextResponse.json({
      status: record.status,
      createdAt: record.createdAt,
      reviewedAt: record.reviewedAt,
      rejectionReason: record.rejectionReason,
    });
  }

  // Granted — surface the raw code (kept access-gated on the request row).
  const codeRecord = record.codeId ? await findByCodeId(record.codeId) : null;
  return NextResponse.json({
    status: "granted",
    code: record.rawCode,
    codeId: record.codeId,
    codeStatus: codeRecord?.status ?? null,
    expiresAt: codeRecord?.expiresAt ?? null,
    ttlHours: codeRecord?.ttlHours ?? null,
  });
}
