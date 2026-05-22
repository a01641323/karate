# Curl-installable local binary — design

## Context

Today an operator who wants to run the local server has to:

1. Clone `<owner>/<repo>`.
2. Install Node 20 + pnpm.
3. Run `pnpm install && pnpm build`.
4. `cd apps/local && pnpm start`.
5. Open `http://localhost:4747` and paste their access code.

Steps 1–4 are a wall for non-technical operators. This spec collapses
them into a single shell-pastable command:

```
curl -fsSL kumiteos.vercel.app/install.sh | sh
```

(Windows: `iwr -useb kumiteos.vercel.app/install.ps1 | iex`.)

After the one-liner finishes, the binary is running on `localhost:4747`,
the browser is open on the lock screen, and the operator is one
code-paste away from a working tournament. LAN guests open
`http://<host-ip>:4747` directly — no install on their side.

The cloud already has `/download` and a 501 stub at
`/api/downloads/[os]`; there is no CI/release pipeline yet, and
`apps/local` runs from TypeScript via `tsx` (not compiled). This work
fills those gaps without touching scoring / bracket / activation logic.

User-confirmed decisions:

- **Bundle shape:** self-contained binary (Bun `--compile`), no Node
  required on the host.
- **Cross-platform:** one `install.sh` for macOS + Linux with arch
  auto-detect; separate `install.ps1` for Windows.
- **Post-install:** installer launches the binary and opens the browser.
- **Release pipeline:** GitHub Actions matrix → GitHub Releases → cloud
  redirect. All free at current volume.
- **Web bundling:** `apps/web/out` is embedded inside the binary; one
  artifact per OS.
- **State persistence:** moved to `~/.kumiteos/data/` so re-installs are
  non-destructive.

## Critical files

### New
- `apps/local/build-bundle.ts` — copies `apps/web/out` → `apps/local/embedded/web/`, writes `version.json` with git SHA + tag. Run in CI before `bun build`.
- `apps/local/src/embedded-static.ts` — Bun `import.meta.dir`-based static handler. Dev fallback when `KARATE_DEV=1`.
- `.github/workflows/release.yml` — tag-triggered matrix build.
- `apps/cloud/public/install.sh` — POSIX shell installer.
- `apps/cloud/public/install.ps1` — PowerShell installer for Windows.

### Modified
- `apps/local/package.json` — add `build:bin` script, declare Bun as dev tooling.
- `apps/local/src/standalone.ts` — swap the static-file middleware for `embedded-static.ts`. Default `dataDir` to `~/.kumiteos/data` (override via `KARATE_DATA_DIR`).
- `apps/cloud/app/api/downloads/[os]/route.ts` — replace 501 stub with GitHub Releases lookup + 302 redirect. KV-cached for 60 s.
- `apps/cloud/app/download/page.tsx` — surface the curl one-liner above the per-OS cards.
- `README.md` — replace the manual install section with the curl one-liner; keep the source-build section as "for contributors".

### Unchanged (deliberately)
- Express + WebSocket server (`apps/local/src/network/*`).
- JWT activation / cloud public-key verify.
- `/api/discover`, pending-connection approval, BroadcastChannel sync.
- `apps/web/out` content and `packages/core`.

## Implementation order

Each cluster lands as its own commit/PR so it's independently verifiable.

### A. Binary build path (no cloud changes yet)
1. Add Bun dev dep; write `build-bundle.ts` and `embedded-static.ts`.
2. Wire `apps/local/src/standalone.ts` to use the embedded handler when
   `KARATE_DEV` is unset.
3. Add `pnpm build:bin` that runs the chain locally: web build →
   bundle → `bun build --compile --target=bun-darwin-arm64` etc.
4. Verify on dev machine: produced `kumiteos-darwin-arm64` runs,
   serves the static frontend, accepts activation, scores a match.

### B. Release pipeline
1. Write `.github/workflows/release.yml` with the 4-runner matrix.
2. Push a `v0.1.0-test` tag; confirm a GitHub Release appears with 4
   assets named `kumiteos-<target>`.
3. Replace the 501 stub at `/api/downloads/[os]` with the
   release-lookup + 302 redirect, including a 60 s KV cache wrapper.
4. Smoke test: `curl -I kumiteos.vercel.app/api/downloads/darwin-arm64`
   returns 302 with a `Location:` header pointing at the GitHub asset.

### C. Installer scripts + UX
1. Write `apps/cloud/public/install.sh` (uname-based detection, atomic
   write, post-launch browser-open).
2. Write `apps/cloud/public/install.ps1` (PowerShell equivalent).
3. Update `/download` page: curl one-liner at the top, per-OS cards
   below as a fallback.
4. Update README: curl one-liner first; source-build section moved
   under a "For contributors" header.

## Distribution architecture

```
operator shell
   │  curl -fsSL kumiteos.vercel.app/install.sh | sh
   ▼
install.sh (Vercel static)
   │  uname → darwin-arm64 | darwin-x64 | linux-x64
   │
   ▼
GET /api/downloads/<target>          (Vercel route)
   │  KV cache (60 s TTL) | GitHub API: releases/latest
   │  find asset matching kumiteos-<target>*
   ▼
302 → https://github.com/.../releases/download/vX.Y.Z/kumiteos-<target>
   │
   ▼
~/.local/bin/kumiteos (or %LOCALAPPDATA%\kumiteos\kumiteos.exe)
   │  exec &
   ▼
kumiteos binary
   │  embedded apps/web/out via Bun import.meta.dir
   │  Express + WS on 0.0.0.0:4747
   │  data dir = ~/.kumiteos/data
   │  JWT verify against kumiteos.vercel.app/api/public-key
   ▼
http://localhost:4747 (auto-opened)
   • paste 6-digit code → activated
   • LAN guests: http://<host-ip>:4747 → operator approves WS handshake
```

## Error / edge cases

| Case | Handling |
|---|---|
| Unsupported OS/arch | `install.sh` exits with a one-line error pointing to `/download` |
| No GitHub release yet | `/api/downloads/[os]` returns 503 `{ error: "no_release" }`; installer prints "No build available yet, contact admin" |
| GitHub API rate-limited | KV-cached release lookup (60 s TTL). If both cache + live fail: 503 with clear message |
| Port 4747 already taken | Binary exits with readable error; installer prints "Another instance is already running on 4747 — open http://localhost:4747" |
| macOS Gatekeeper block | Installer prints `xattr -d com.apple.quarantine ~/.local/bin/kumiteos` workaround. Long-term notarization deferred |
| Windows SmartScreen | `install.ps1` documents the "More info → Run anyway" flow. Code signing deferred |
| `~/.local/bin` not on PATH | Non-fatal; installer prints PATH-add hint. Auto-launch still works (uses absolute path) |
| Re-running installer | Idempotent: overwrites the binary in place, then re-launches. `~/.kumiteos/data/` is never touched |
| Upgrade between releases | Same path as re-run; KV cache + GitHub Releases handle version pinning |

## Verification

Manual end-to-end on each OS in order.

**Pre-release (from dev machine):**
- Tag `v0.1.0-test`; confirm 4 matrix jobs succeed and the release has 4 assets.
- `curl -I kumiteos.vercel.app/api/downloads/darwin-arm64` returns 302 → GitHub asset.

**macOS (Apple Silicon):**
- On a clean user account (no Node/pnpm): `curl -fsSL kumiteos.vercel.app/install.sh | sh`.
- Browser opens to `http://localhost:4747`; pasting a real access code activates the app.
- Score a match end-to-end.
- From a second machine on the same Wi-Fi: open `http://<host-ip>:4747`; operator approves the pending connection; scoring mirrors within ~1 s.
- Quit and re-run the installer; `~/.kumiteos/data/` survives and the tournament reopens.

**Linux + Windows:** same steps with `install.sh` / `install.ps1`.

**Regression sweep (must NOT break):**
- Cloud activation flow against `kumiteos.vercel.app`.
- LAN auto-discovery + manual IP entry fallback.
- BroadcastChannel public-display tab sync.
- Superadmin chord (Option+1+2+3 + KARIAS).
- Pace badges, area-disable toggle, check-in flow.

## Out of scope

Deliberately deferred so the first iteration ships:

- Apple notarization / Windows code-signing certs.
- Auto-update on launch (operator re-runs the installer to upgrade).
- Homebrew tap / `winget` manifest.
- ARM64 Windows / ARM64 Linux builds.
- Migration off GitHub Releases (bandwidth headroom is fine at current volume).
- Linux desktop integration (`.desktop` files, system-tray icon).
