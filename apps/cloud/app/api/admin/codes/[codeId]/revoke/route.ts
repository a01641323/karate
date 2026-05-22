import { NextResponse } from "next/server";
import { revokeCode } from "@/lib/tokens";
import { requireSuperadmin } from "@/lib/admin-guard";

export const runtime = "nodejs";

interface RouteContext { params: Promise<{ codeId: string }> }

export async function POST(_req: Request, ctx: RouteContext) {
  const denied = await requireSuperadmin();
  if (denied) return denied;
  const { codeId } = await ctx.params;
  if (!codeId) return NextResponse.json({ error: "missing_codeId" }, { status: 400 });
  const ok = await revokeCode(codeId);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
