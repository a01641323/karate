# Vercel licensing flow — design

**Date:** 2026-05-20
**Status:** Approved, ready for implementation

## Context

The karate tournament app currently ships as a single `apps/server` that handles both the tournament engine *and* JWT licensing locally. Claim codes are generated through a local admin endpoint, redeemed against the same server, and the JWT is signed by per-machine Ed25519 keys generated on first run.

We want to evolve this into a Nessus-style commercial flow:

- A public website (deployed on Vercel) where prospective users request access.
- A superadmin (just the project owner) approves requests and the website mints activation codes.
- Users download a single-file binary of the local app, paste the code, and run a tournament offline for 24h.
- After expiry the local app locks until a new code is activated. No subscription, no renewal — per-tournament one-shot purchase (free for now, future Stripe).

This requires splitting the existing monolith into a cloud licensing authority on Vercel and a downloadable local consumer, while leaving the tournament engine, scoreboard, LAN flow, and superadmin chord exactly as they are today.

## Goals

- Public can request a token; project owner approves; code appears on the requester's browser page (cookie + bookmarkable recovery URL — **no email infrastructure**).
- Downloaded binary verifies cloud-signed JWTs offline using an embedded public key.
- Each code is one-shot, machine-locked, valid 24h. No renewal endpoint.
- Tournament engine, WebSocket protocol, LAN connection screen, BroadcastChannel sync, superadmin chord, public-display flow: **untouched**.
- Zero paid third-party APIs in v1. Only free tiers / built-ins (Vercel KV, Vercel hosting, GitHub OAuth, GitHub Releases).

## Non-goals (v1)

- Stripe / payments.
- Email delivery.
- Automatic code signing for macOS / Windows binaries.
- In-app auto-update.
- End-user accounts / dashboards (each request is independent).
- Multi-superadmin support.

## Architecture

Two applications + the existing shared `packages/core`:

```
karate/
├── apps/
│   ├── cloud/       NEW. Next.js app deployed on Vercel.
│   │                 - Public landing, request form, request-status page, downloads
│   │                 - Superadmin panel (GitHub OAuth, restricted to one GitHub ID)
│   │                 - API: /api/request-token, /api/admin/*, /api/activate, /api/verify-jti
│   │                 - DB: Vercel KV
│   │                 - Holds the Ed25519 PRIVATE key (signs JWTs)
│   │
│   ├── local/       RENAMED from apps/server. The downloadable binary.
│   │                 - Express + WS tournament engine (unchanged)
│   │                 - Embeds cloud's Ed25519 PUBLIC key at build time
│   │                 - Verifies JWTs offline
│   │                 - /api/activate proxies to cloud
│   │                 - Bun-compiled to a single binary per OS
│   │
│   └── web/         Existing Next.js frontend. Built once, packaged INSIDE
│                    apps/local's binary. No standalone deploy.
│
└── packages/core/   Unchanged.
```

**Trust model:** The cloud holds the only Ed25519 private key. Local binaries embed only the public key, baked in at compile time. Key rotation requires re-releasing the binary.

**API surface between cloud and local** is exactly two endpoints:
- `POST /api/activate` — code + machine fingerprint → JWT. One-shot per code.
- `GET /api/verify-jti?jti=...` — optional revocation check on launch.

## Token lifecycle

```
1. REQUEST (public)
   Visitor → cloud /request → form (email, optional org/date/notes)
   → POST /api/request-token
   → KV: req:<id> = { email, fields, status: "pending", createdAt, accessTokenHash }
   → KV: req:byCookie:<accessHash> = <id>
   → KV SADD req:pending <id>
   → Response sets signed httpOnly cookie + redirects to /pending/[id]

2. PENDING PAGE (cookie or ?key= recovery URL)
   /pending/[id] polls /api/requests/[id]/status every ~5s
   While status == "pending" → "Waiting for approval"
   Bookmarkable URL: /pending/[id]?key=<accessToken>

3. APPROVAL (GitHub-OAuth gated to one GitHub ID)
   You → /admin → see pending count + table
   → POST /api/admin/requests/[id]/grant
   → Cloud mints 6-digit code, stores SHA-256 hash in KV
   → KV: code:<codeHash> = { codeId, requestId, status: "unused",
                              expiresAt: now+30d, machineFp: null,
                              jti: null, ttlHours: 24 }
   → KV: req:<id>.status = "granted", req:<id>.codeId = <codeId>
   → KV SREM req:pending <id>

4. CODE REVEAL
   Next /pending/[id] poll returns { status: "granted", code: "123456" }
   Page shows large copy-able code box + download link

5. DOWNLOAD (public — no code required to download)
   /download → OS picker → /api/downloads/[os] returns 5-min signed GitHub Release URL

6. ACTIVATE (machine-bound, one-shot)
   Binary boot → opens http://localhost:4747 → lock-screen "paste code"
   → local /api/activate proxies to cloud /api/activate { code, machineFingerprint }
   → Cloud: verify code unused, not expired, no other machine claimed
   → Mark code "used", bind machineFp, generate jti
   → Sign JWT { sub: codeId, exp: now+24h, machine_fp, jti }
   → Return JWT to local app; cache in ./data/license.bin
   → Lock-screen unlocks

7. USE (offline-capable, 24h)
   Local app verifies JWT against embedded public key. No network required.

8. EXPIRE (hard)
   At exp, lock-screen returns: "Tournament session ended. Request a new
   code at <cloud-url>." No renewal endpoint exists.

9. REVOCATION (optional safety valve)
   /admin → mark code revoked → KV jti:revoked:<jti> = "1"
   Local app, if online, calls /verify-jti on launch. Offline = continue.
   v1 ships this OFF by default; flip a build flag to enable.
```

**Properties:**
- One-shot: each code activates exactly one machine, exactly once.
- No renewal: expired = locked = request again.
- 30-day grace before unused codes die in KV.
- Cookie + URL: requester doesn't need an account; cookie carries them, URL is the cross-device fallback.

## apps/cloud — components

```
apps/cloud/
├── app/
│   ├── page.tsx                              Landing
│   ├── request/page.tsx                      Public request form
│   ├── pending/[requestId]/page.tsx          Status + reveal page
│   ├── download/page.tsx                     OS picker
│   ├── admin/
│   │   ├── layout.tsx                        Auth guard
│   │   ├── page.tsx                          Dashboard
│   │   ├── requests/page.tsx                 Pending / granted / rejected / revoked
│   │   └── login/page.tsx                    GitHub OAuth entry
│   └── api/
│       ├── request-token/route.ts            POST
│       ├── requests/[id]/
│       │   ├── status/route.ts               GET (cookie or ?key=)
│       │   └── route.ts                      GET
│       ├── admin/
│       │   ├── requests/route.ts             GET (auth)
│       │   ├── requests/[id]/
│       │   │   ├── grant/route.ts            POST (auth)
│       │   │   └── reject/route.ts           POST (auth)
│       │   └── codes/[id]/revoke/route.ts    POST (auth)
│       ├── activate/route.ts                 POST — public, called by local app
│       ├── verify-jti/route.ts               GET — public, called by local app
│       ├── downloads/[os]/route.ts           GET — 302 to signed GitHub Release URL
│       ├── latest-version/route.ts           GET — { version, releasedAt }
│       └── auth/[...nextauth]/route.ts       Auth.js v5 GitHub OAuth
│
├── lib/
│   ├── kv.ts                                 Vercel KV client
│   ├── keys.ts                               Loads PRIVATE key from env
│   ├── tokens.ts                             6-digit code generation, SHA-256 hashing
│   ├── jwt.ts                                EdDSA JWT signing (jose), 24h TTL
│   ├── cookie.ts                             Signed httpOnly cookie helpers (HMAC)
│   ├── auth.ts                               Auth.js config + your-GitHub-ID guard
│   └── github-release.ts                     Fine-scoped PAT → signed download URLs
│
└── package.json
```

### KV schema

```
req:<requestId>           → { email, fields, status, createdAt, accessTokenHash, codeId? }
req:byCookie:<accessHash> → requestId
req:pending               → SET of requestIds in pending
code:<codeHash>           → { codeId, requestId, status, expiresAt, machineFp, jti, ttlHours }
jti:revoked:<jti>         → "1"
release:current           → { version, binaries: { "darwin-arm64": "<asset-id>", ... } }
admin:lastSeen:<gh_id>    → timestamp
```

### Environment variables

```
KV_REST_API_URL          (auto from Vercel KV integration)
KV_REST_API_TOKEN        (auto)
KEY_PRIVATE_PEM          Ed25519 private key, PEM, \n-escaped
KEY_PUBLIC_PEM           Ed25519 public key, PEM (also baked into local binary)
GITHUB_CLIENT_ID         OAuth app
GITHUB_CLIENT_SECRET     OAuth app
SUPERADMIN_GITHUB_ID     numeric GitHub user ID — ONLY id allowed in /admin
AUTH_SECRET              32-byte hex for Auth.js
COOKIE_SECRET            32-byte hex for request-cookie HMAC
GITHUB_RELEASE_PAT       fine-scoped PAT, read-only on releases of <owner>/<repo>
GITHUB_RELEASE_REPO      "<owner>/<repo>"
```

### Reused from existing code

- `apps/server/src/licenses.ts` — code generation / hashing / `ClaimCodeRecord` shape → moves to `apps/cloud/lib/tokens.ts`, KV-backed instead of JSON file.
- `apps/server/src/auth.ts` — `signLicenseToken()` Ed25519 signing → copied to `apps/cloud/lib/jwt.ts`, same JWT shape and algorithm.

## apps/local — surgical changes

### Untouched (do not modify)

- `apps/local/src/network/*` (was `apps/server/src/network/*`) — protocol, state-store, ws-server, persistence, controller, routes. WebSocket protocol, action reducer, timer tick, ping loop, pending-connection approval.
- `packages/core/*` — bracket logic, scoring, area assignment engine, mock generator, types.
- `apps/web/*` — admin / private / public / area-select pages, scoreboard, jury modal, BroadcastChannel sync, manual-IP connection screen, superadmin overlay, lock screen, public-display window.
- `apps/local/src/data-store.ts`, `activity.ts`, `app-config.ts`, `local-admin-auth.ts`, `rate-limit.ts`, `storage.ts`.
- `/api/discover`, WS upgrade on `/ws`, loopback auto-approve, BroadcastChannel sync.
- Superadmin chord (Option/Alt+1+2+3 + KARIAS), local-admin loopback token, `/admin-panel` HTML.

### Changes

1. **Rename:** `apps/server` → `apps/local`. Workspace name `@karate/server` → `@karate/local`.
2. **Strip code-issuance endpoints** from `apps/local/src/routes.ts`:
   - Delete: `POST /api/admin/licenses`, `POST /api/admin/licenses/:userId/revoke`, `POST /api/admin/licenses/:userId/transfer`, `POST /api/admin/licenses/:userId/extend`. These live on the cloud.
   - Keep: `GET /api/admin/licenses` (read-only inspect of *this* machine's active license).
3. **Replace local signing with cloud verification:**
   - Delete `apps/local/src/keys.ts` runtime key generation. Replace with `apps/local/src/cloud-key.ts` exporting the embedded public-key PEM as a constant (inlined by Bun's compile).
   - `apps/local/src/auth.ts`: keep `requireAuth`, drop `signLicenseToken()`. Verification only.
   - `apps/local/src/licenses.ts`: shrink to read-only `LicenseStore` that caches the activated JWT + jti + machineFp in `./data/license.bin`. No code creation.
4. **`/api/activate` becomes a proxy:**
   - Local `/api/activate` POSTs `{ code, machineFingerprint }` to `https://<cloud-domain>/api/activate`, stores the returned JWT, returns the same response shape to the renderer.
   - Renderer (`apps/web/lib/auth-context.tsx`) unchanged.
   - Cloud URL via env var `KARATE_CLOUD_URL` (default baked at compile time).
5. **Drop `/api/renew-token` entirely.** No renewal path. Expired JWT → lock-screen forever until new activation.
6. **Optional `/verify-jti` check on launch** — fire-and-forget. Offline = continue. Default OFF in v1.
7. **Bun compile pipeline:**
   - New: `apps/local/scripts/build-binary.ts` runs `bun build --compile --target=bun-<os-arch> ./src/standalone.ts --outfile=dist/karate-<os-arch>{.exe?}`.
   - `apps/web/out/` is embedded into the binary so static files travel with it.
   - Output: 4 binaries (~70–90 MB each).
8. **First-run UX:**
   - Boot Express + WS on `127.0.0.1:4747` (binds `0.0.0.0` only if `KARATE_LAN=1`).
   - Print URL to stdout.
   - Open OS default browser at `http://localhost:4747` (`open` / `xdg-open` / `start`).
   - Lock-screen detects no cached JWT → shows existing activation form (`apps/web/components/lock-screen.tsx`) → existing `apiActivate(code, fingerprint)` flow.

**Files changed:** ~8–10. Tournament logic, WS, LAN, scoreboard, area engine: zero lines touched.

## Distribution

### Build pipeline

GitHub Actions on tag push (free for private repos at this scale):

```
.github/workflows/release.yml
  - matrix on: macos-latest (darwin-arm64, darwin-x64), ubuntu-latest (linux-x64),
               windows-latest (win-x64)
  - steps:
      1. pnpm install
      2. pnpm --filter @karate/web build
      3. pnpm --filter @karate/local build-binary --target=<this-os>
      4. upload artifact: karate-<os>-<arch>{.exe?}
  - aggregate job:
      5. create GitHub Release (private) attaching the 4 binaries
      6. POST release manifest to cloud /api/admin/releases (deploy hook
         writes KV release:current)
```

### Where binaries live

Two-stage delivery:
1. **GitHub Releases** stores binaries (free, 2 GB/file, unlimited bandwidth).
2. **Cloud `/api/downloads/[os]`** redirects via short-lived (5 min) signed URL using `GITHUB_RELEASE_PAT`. Repo stays private; download URLs are unguessable.

### OS picker

`/download` sniffs User-Agent to pre-select, but shows all four explicitly:
- Download for macOS (Apple Silicon) → `karate-darwin-arm64`
- Download for macOS (Intel) → `karate-darwin-x64`
- Download for Windows → `karate-win-x64.exe`
- Download for Linux → `karate-linux-x64`

### Code signing

Out of scope for v1. macOS unsigned binaries require right-click → Open → confirm once. Windows SmartScreen shows "publisher unknown — keep / discard". Document this in `/download`. Future: Apple Developer ID ($99/yr), Windows EV cert ($200–500/yr).

### Versioning

`/download` always serves the latest. Local binary, on launch, calls `GET /api/latest-version`; if newer exists, the lock-screen shows a "New version available" banner. No in-place auto-update.

## Error handling

- **Cloud `/api/activate` unreachable** → local app shows lock-screen error "Cannot reach licensing server. Check internet and retry." Activation requires online; document explicitly.
- **Code already used on another machine** → cloud returns `409 CODE_ALREADY_USED`. Local app surfaces "This code is already activated on another machine. Request a new one."
- **Code expired (>30 days unused)** → cloud returns `410 CODE_EXPIRED`. Local app surfaces "This code has expired. Request a new one."
- **JWT expired locally** → existing lock-screen with degraded-reason `session_expired`. Add a button "Request a new code" linking to cloud `/request`.
- **Cookie lost on pending page** → 404 unless `?key=` provided. Pending page prominently shows the recovery URL while waiting.
- **GitHub OAuth identity mismatch** → `/admin` rejects with 403. Log attempts.

## Testing

- **Unit tests on cloud:**
  - `lib/tokens.ts`: code generation uniformity, hash collision avoidance.
  - `lib/jwt.ts`: sign + verify roundtrip with the embedded public key.
  - `lib/cookie.ts`: HMAC sign + verify, tamper detection.
  - `/api/activate`: code not found / revoked / expired / already-used / success.
  - `/api/admin/requests/grant`: auth required, idempotency on double-grant.
- **Integration tests on cloud:**
  - Full happy path: request → pending → grant → reveal → activate → verify JWT.
  - Cookie-only and `?key=`-only access to pending page.
  - GitHub OAuth identity gate.
- **Local app:**
  - `/api/activate` proxy: cloud success / cloud error / network failure.
  - JWT verification with embedded public key.
  - Lock-screen behavior on cached-expired JWT.
- **End-to-end manual:**
  - Bun-compiled binary boots, opens browser, accepts a real cloud code.
  - JWT survives binary restart (cached in `./data/license.bin`).
  - JWT expiry locks the app.
  - LAN guest connection still works (regression check).
  - Superadmin chord still works (regression check).

## Sequencing

The implementation plan (next skill, `writing-plans`) will sequence these as:

1. Rename `apps/server` → `apps/local`, strip code-issuance endpoints, drop renewal, add proxy `/api/activate`. Verify existing tournament/LAN/chord still work.
2. Scaffold `apps/cloud` (Next.js + KV + Auth.js). Implement public request form, pending page (cookie + key), admin panel with GitHub OAuth gate, grant flow, `/api/activate` cloud-side.
3. Generate the Ed25519 keypair once, store private in cloud env, bake public into local binary.
4. Bun compile pipeline + GitHub Actions release workflow.
5. `/download` page + signed GitHub Release proxy.
6. End-to-end smoke test on a fresh machine.
7. Deploy `apps/cloud` to Vercel, cut the first release of `apps/local`.

## Open questions to revisit later (not v1)

- Stripe integration for paid tournaments.
- Multi-machine activations per tournament (currently one machine per code).
- In-app version updates.
- Code signing for unsigned-binary friction.
- Email delivery (Resend) for "your code is ready" notifications.
- Multi-superadmin support.
- Tournament-day TTL granularity (currently 24h; might want 12h or 36h presets).
