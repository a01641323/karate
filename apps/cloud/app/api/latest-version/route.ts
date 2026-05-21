import { NextResponse } from "next/server";
import { kv, keys } from "@/lib/kv";

export const runtime = "nodejs";

export async function GET() {
  const current = await kv.get<{ version: string; releasedAt: number }>(keys.releaseCurrent);
  return NextResponse.json({
    version: current?.version ?? null,
    releasedAt: current?.releasedAt ?? null,
  });
}
