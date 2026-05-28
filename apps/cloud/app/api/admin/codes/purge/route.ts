import { NextResponse } from "next/server";
import { purgeInactiveCodes } from "@/lib/tokens";
import { requireSuperadmin } from "@/lib/admin-guard";

export const runtime = "nodejs";

// Bulk-delete every code that is already revoked or expired, reclaiming
// the KV storage they and their attached bundles occupy.
export async function POST() {
  const denied = await requireSuperadmin();
  if (denied) return denied;
  const { deleted } = await purgeInactiveCodes();
  return NextResponse.json({ ok: true, deleted });
}
