import { NextRequest, NextResponse } from "next/server";
import { kv, keys } from "@/lib/kv";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jti = req.nextUrl.searchParams.get("jti")?.trim();
  if (!jti) return NextResponse.json({ error: "missing_jti" }, { status: 400 });
  const revoked = (await kv.get<string>(keys.jtiRevoked(jti))) === "1";
  return NextResponse.json({ revoked });
}
