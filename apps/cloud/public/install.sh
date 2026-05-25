#!/bin/sh
# Kumite/OS installer — macOS + Linux.
# Usage:  curl -fsSL https://kumiteos.vercel.app/install.sh | sh
#
# Resolves your OS/arch, downloads the matching tarball from the cloud
# redirect, extracts to ~/.kumiteos/app/, launches the binary, and opens
# http://localhost:4747 in your default browser. Tournament state is
# stored at ~/.kumiteos/data/ — re-running the installer is safe (it
# only replaces the binary + web assets, never the data).

set -eu

CLOUD="${KUMITEOS_CLOUD:-https://kumiteos.vercel.app}"
INSTALL_ROOT="${KUMITEOS_HOME:-$HOME/.kumiteos}"
APP_DIR="$INSTALL_ROOT/app"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$OS-$ARCH" in
  darwin-arm64)        TARGET=darwin-arm64 ;;
  darwin-x86_64)       TARGET=darwin-x64 ;;
  linux-x86_64|linux-amd64) TARGET=linux-x64 ;;
  *)
    echo "Unsupported platform: $OS-$ARCH" >&2
    echo "Open $CLOUD/download in your browser for manual install options." >&2
    exit 1
    ;;
esac

echo "==> Installing kumiteos ($TARGET) → $APP_DIR"
mkdir -p "$APP_DIR"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
TARBALL="$TMPDIR/kumiteos.tar.gz"

echo "==> Downloading from $CLOUD/api/downloads/$TARGET"
if ! curl -fSL --retry 2 --retry-delay 1 -o "$TARBALL" "$CLOUD/api/downloads/$TARGET"; then
  echo "Download failed. The release might not be published yet." >&2
  echo "Check $CLOUD/download for status." >&2
  exit 1
fi

echo "==> Extracting"
tar -xzf "$TARBALL" -C "$TMPDIR"
# Tarball root is kumiteos-<target>/  — move its contents into $APP_DIR.
EXTRACTED="$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -type d -name 'kumiteos-*' | head -n1)"
if [ -z "$EXTRACTED" ]; then
  echo "Unexpected tarball layout. Aborting." >&2
  exit 1
fi
# Replace binary + web atomically-ish; data dir is outside APP_DIR.
rm -rf "$APP_DIR/web" "$APP_DIR/kumiteos" "$APP_DIR/version.json"
mv "$EXTRACTED"/* "$APP_DIR/"
chmod +x "$APP_DIR/kumiteos"

# macOS Gatekeeper: strip quarantine so the first launch doesn't pop a
# "developer cannot be verified" dialog. No-op on Linux.
if [ "$OS" = "darwin" ]; then
  xattr -d com.apple.quarantine "$APP_DIR/kumiteos" 2>/dev/null || true
fi

# Best-effort symlink onto PATH so `kumiteos` works from any shell.
if [ -w "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
  ln -sf "$APP_DIR/kumiteos" "$HOME/.local/bin/kumiteos" 2>/dev/null || true
fi

# Make sure ~/.local/bin is on PATH for future shells. We append a
# guarded block (marker comments make this idempotent — re-running the
# installer never duplicates). Touches .zshrc AND .bashrc because some
# users have zsh as their login shell but bash for sub-shells.
ensure_on_path() {
  rc="$1"
  [ -e "$rc" ] || touch "$rc"
  if ! grep -q "kumiteos PATH" "$rc" 2>/dev/null; then
    cat >> "$rc" <<'BLOCK'

# >>> kumiteos PATH >>>
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac
# <<< kumiteos PATH <<<
BLOCK
    echo "==> Added ~/.local/bin to PATH in $rc"
  fi
}
ensure_on_path "$HOME/.zshrc"
ensure_on_path "$HOME/.bashrc"

# Export for the *current* shell too, so the post-install instruction
# "type kumiteos to relaunch" works without opening a new terminal.
export PATH="$HOME/.local/bin:$PATH"

# Refuse to launch if port 4747 is already taken — most likely another
# instance is already running, and double-launching corrupts the data
# dir.
if command -v lsof >/dev/null 2>&1 && lsof -i :4747 >/dev/null 2>&1; then
  echo "==> Port 4747 is already in use — looks like kumiteos is already running."
  echo "    Open http://localhost:4747 in your browser."
  exit 0
fi

echo "==> Launching"
KARATE_CLOUD_URL="$CLOUD" \
  nohup "$APP_DIR/kumiteos" >"$INSTALL_ROOT/kumiteos.log" 2>&1 &
sleep 1

# Open the browser. open(1) on macOS, xdg-open on Linux.
if command -v open >/dev/null 2>&1; then
  open http://localhost:4747 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:4747 >/dev/null 2>&1 || true
else
  echo "    Open http://localhost:4747 in your browser to finish activation."
fi

cat <<EOF

==> kumiteos is running.
    Web UI:    http://localhost:4747
    Logs:      $INSTALL_ROOT/kumiteos.log
    Data dir:  $INSTALL_ROOT/data
    Binary:    $APP_DIR/kumiteos

Paste your 6-digit access code in the lock screen.
LAN guests can open  http://<this-machine-ip>:4747  in their browsers.

Useful commands (from any terminal):
    kumiteos          launch the server again
    kumiteos update   pull the latest version
EOF
