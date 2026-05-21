import { NextResponse } from "next/server";
import { markRejected } from "@/lib/requests";
import { requireSuperadmin } from "@/lib/admin-guard";

export const runtime = "nodejs";

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: RouteContext) {
  const denied = await requireSuperadmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  let reason: string | undefined;
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body.reason === "string") reason = body.reason.trim().slice(0, 500);
  } catch { /* no body */ }

  const next = await markRejected(id, reason);
  if (!next) return NextResponse.json({ error: "not_found_or_not_pending" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
