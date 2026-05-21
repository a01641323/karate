// Placeholder for the signed GitHub-Release redirect. The release
// pipeline isn't wired yet (next PR); for now we return 501 so the
// download page has a real target to point at.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VALID = new Set(["darwin-arm64", "darwin-x64", "win-x64", "linux-x64"]);

interface RouteContext { params: Promise<{ os: string }> }

export async function GET(_req: Request, ctx: RouteContext) {
  const { os } = await ctx.params;
  if (!VALID.has(os)) return NextResponse.json({ error: "unknown_os" }, { status: 404 });
  // TODO: read release:current from KV, mint signed GitHub Release URL,
  // 302 redirect. Tracked in the spec under "Distribution".
  return NextResponse.json(
    { error: "release_pipeline_not_ready", os },
    { status: 501 },
  );
}
