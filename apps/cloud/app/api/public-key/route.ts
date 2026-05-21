// Public-key publication. apps/local fetches this at boot when
// KARATE_CLOUD_URL is set so it can verify cloud-signed JWTs locally
// (no network round-trip per request). Once the binary release
// pipeline ships, the local app will embed the PEM at compile time
// and stop calling this endpoint — but until then this is how the
// trust chain is established.
//
// The returned PEM is the SAME public key that signs activate tokens
// in /api/activate, so verification roundtrips exactly.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const raw = process.env.KEY_PUBLIC_PEM;
  if (!raw) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  // Vercel env values often arrive with literal "\n" instead of newlines.
  const pem = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  return new NextResponse(pem.trim() + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
