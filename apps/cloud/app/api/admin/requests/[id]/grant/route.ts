import { NextResponse } from "next/server";
import { getRequest, markGranted } from "@/lib/requests";
import { mintCode } from "@/lib/tokens";
import { requireSuperadmin } from "@/lib/admin-guard";

export const runtime = "nodejs";

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: RouteContext) {
  const denied = await requireSuperadmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const cur = await getRequest(id);
  if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (cur.status !== "pending") {
    return NextResponse.json({ error: `already_${cur.status}` }, { status: 409 });
  }

  const { code, record } = await mintCode({ requestId: id });
  const next = await markGranted(id, record.codeId, code);
  if (!next) return NextResponse.json({ error: "race_lost" }, { status: 409 });
  return NextResponse.json({ ok: true, codeId: record.codeId });
}
