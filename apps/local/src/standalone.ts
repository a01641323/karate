import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { createServer } from "./index";

const INSTALL_ROOT =
  process.env.KUMITEOS_HOME ?? path.join(os.homedir(), ".kumiteos");
const PID_FILE = path.join(INSTALL_ROOT, "kumiteos.pid");

function localIPv4s(): string[] {
  const out: string[] = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    if (/^(utun|tailscale|tun|tap|zt|vEthernet|VMware|VirtualBox)/i.test(name)) continue;
    for (const info of ifs[name] ?? []) {
      if (info.family === "IPv4" && !info.internal) out.push(info.address);
    }
  }
  return out;
}

function readVersion(): string {
  // build-bundle writes version.json next to the binary. Try a few
  // likely locations; fall back to "dev" so the command never errors.
  const candidates = [
    path.join(path.dirname(process.execPath), "version.json"),
    path.join(INSTALL_ROOT, "app", "version.json"),
    path.join(process.cwd(), "version.json"),
  ];
  for (const p of candidates) {
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8")) as { tag?: string; gitSha?: string };
      if (j.tag) return j.tag;
      if (j.gitSha) return j.gitSha.slice(0, 7);
    } catch { /* try next */ }
  }
  return "dev";
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  try {
    const p = spawn(cmd[0] as string, cmd[1] as string[], { stdio: "ignore", detached: true });
    p.unref();
  } catch { /* no GUI; user opens manually */ }
}

async function probeRunning(port: number, timeoutMs = 500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function writePidFile(): void {
  try {
    fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch {
    // Non-fatal: `kumiteos update` falls back to a port-based kill.
  }
}

function clearPidFile(): void {
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
}

async function main() {
  // ---------- subcommand dispatch ----------
  const sub = process.argv[2];

  if (sub === "version" || sub === "--version" || sub === "-v") {
    // eslint-disable-next-line no-console
    console.log(`kumiteos ${readVersion()}`);
    process.exit(0);
  }
  if (sub === "update") {
    const { runUpdate } = await import("./update");
    process.exit(await runUpdate());
  }
  if (sub === "help" || sub === "--help" || sub === "-h") {
    // eslint-disable-next-line no-console
    console.log(
`kumiteos — tournament scoreboard server

Usage:
  kumiteos              Start the server and open the browser.
  kumiteos update       Pull the latest version and relaunch.
  kumiteos version      Print the installed version.
  kumiteos help         Show this message.
`);
    process.exit(0);
  }

  // ---------- already-running self-heal ----------
  // If something is already serving 4747, open the browser to it
  // instead of crashing with EADDRINUSE.
  if (await probeRunning(4747)) {
    // eslint-disable-next-line no-console
    console.log("[kumiteos] ya está corriendo — abriendo http://localhost:4747");
    openBrowser("http://localhost:4747");
    process.exit(0);
  }

  // ---------- normal launch ----------
  const server = await createServer();
  const { port } = await server.start();

  writePidFile();
  const cleanup = () => { clearPidFile(); process.exit(0); };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", clearPidFile);

  // eslint-disable-next-line no-console
  console.log(`[karate-server] listening on http://0.0.0.0:${port}`);
  // eslint-disable-next-line no-console
  console.log(`[karate-server] data dir: ${server.config.dataDir}`);
  // eslint-disable-next-line no-console
  console.log(`[karate-server] open on this machine:  http://localhost:${port}`);
  for (const ip of localIPv4s()) {
    // eslint-disable-next-line no-console
    console.log(`[karate-server] open on the LAN:       http://${ip}:${port}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[karate-server] admin panel: http://localhost:${port}/admin-panel`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[karate-server] failed to start:", err);
  process.exit(1);
});
