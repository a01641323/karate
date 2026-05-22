// Streams the matching binary for <target> through the cloud so curl
// never sees the upstream URL. The original 302-redirect leaked the
// repo path into the Location header during install; this proxies the
// bytes so the client only ever talks to kumiteos.vercel.app.
//
// Targets map 1:1 to the assets the release pipeline uploads:
//   darwin-arm64 → kumiteos-darwin-arm64.tar.gz
//   darwin-x64   → kumiteos-darwin-x64.tar.gz
//   linux-x64    → kumiteos-linux-x64.tar.gz
//   win-x64      → kumiteos-win-x64.zip
//
// The release lookup is cached in KV for 60 s. Asset bytes are NOT
// cached — Vercel CDN does that opportunistically for us.

import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export const runtime = "nodejs";
// Bigger response size cap so an 80 MB binary can stream cleanly.
export const maxDuration = 60;

const VALID = new Set(["darwin-arm64", "darwin-x64", "win-x64", "linux-x64"]);
// Override via the RELEASE_REPO env var on Vercel so the source path
// is never hard-coded into the deploy.
const REPO = process.env.RELEASE_REPO ?? "";
const CACHE_KEY = "release:latest";
const CACHE_TTL_S = 60;

interface ReleaseAsset {
  name: string;
  /** Authenticated API URL — must be requested with Accept: octet-stream. */
  api_url: string;
}
interface CachedRelease { tag: string; assets: ReleaseAsset[]; fetchedAt: number }

interface RouteContext { params: Promise<{ os: string }> }

async function fetchLatestRelease(): Promise<CachedRelease | null> {
  if (!REPO) return null;
  const cached = await kv.get<CachedRelease>(CACHE_KEY).catch(() => null);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_S * 1000) return cached;

  const headers: Record<string, string> = {
    "User-Agent": "kumiteos-cloud",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers,
    next: { revalidate: 0 },
  });
  if (!r.ok) return cached ?? null;
  const json = await r.json() as { tag_name: string; assets: Array<{ name: string; url: string }> };
  const next: CachedRelease = {
    tag: json.tag_name,
    assets: (json.assets ?? []).map((a) => ({ name: a.name, api_url: a.url })),
    fetchedAt: Date.now(),
  };
  await kv.set(CACHE_KEY, next, CACHE_TTL_S).catch(() => undefined);
  return next;
}

function matchAsset(assets: ReleaseAsset[], target: string): ReleaseAsset | null {
  const ext = target === "win-x64" ? "zip" : "tar.gz";
  const wanted = `kumiteos-${target}.${ext}`;
  return assets.find((a) => a.name === wanted) ?? null;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { os } = await ctx.params;
  if (!VALID.has(os)) {
    return NextResponse.json({ error: "unknown_os" }, { status: 404 });
  }

  let rel: CachedRelease | null = null;
  try { rel = await fetchLatestRelease(); }
  catch {
    return NextResponse.json({ error: "release_lookup_failed" }, { status: 503 });
  }
  if (!rel) return NextResponse.json({ error: "no_release" }, { status: 503 });

  const asset = matchAsset(rel.assets, os);
  if (!asset) return NextResponse.json({ error: "asset_missing" }, { status: 503 });

  // Stream the asset back to the caller. The API endpoint with
  // Accept: application/octet-stream returns the binary directly when
  // authenticated; without auth, GitHub 302-redirects to the CDN URL
  // and `fetch` transparently follows it — either way, the upstream
  // hostname never appears on the client's wire.
  const headers: Record<string, string> = {
    "User-Agent": "kumiteos-cloud",
    Accept: "application/octet-stream",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const upstream = await fetch(asset.api_url, { headers, redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "upstream_fetch_failed", status: upstream.status },
      { status: 502 },
    );
  }

  const ext = os === "win-x64" ? "zip" : "tar.gz";
  const filename = `kumiteos-${os}.${ext}`;
  const contentType = os === "win-x64" ? "application/zip" : "application/gzip";

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Asset bytes don't change within a release; safe to let edges
      // cache opportunistically. Tag-keyed via the URL prefix.
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Kumiteos-Release": rel.tag,
    },
  });
}
