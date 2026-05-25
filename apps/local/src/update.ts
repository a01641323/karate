// `kumiteos update` — pull the latest version.
//
// Dispatched from standalone.ts when argv[2] === "update". We stop
// any running instance (PID-file first, then anything still holding
// port 4747), wait for the port to free, and then re-run the official
// installer (curl|sh on POSIX, iwr|iex on Windows). The installer
// itself takes care of replacing the binary, preserving the data dir,
// relaunching the new version, and opening the browser.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import * as net from "node:net";

const HOME = os.homedir();
const INSTALL_ROOT =
  process.env.KUMITEOS_HOME ?? path.join(HOME, ".kumiteos");
const PID_FILE = path.join(INSTALL_ROOT, "kumiteos.pid");
const CLOUD = process.env.KUMITEOS_CLOUD ?? "https://kumiteos.vercel.app";
const PORT = 4747;

export async function runUpdate(): Promise<number> {
  console.log("[kumiteos] update — checking for a running instance…");
  await stopRunningServer();

  console.log("[kumiteos] update — waiting for port 4747 to free…");
  const free = await waitForPortFree(PORT, 10_000);
  if (!free) {
    console.error(
      "[kumiteos] could not free port 4747. Close any process using it and retry.",
    );
    return 1;
  }

  console.log("[kumiteos] update — running installer…");
  const cmd =
    process.platform === "win32"
      ? [
          "powershell",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            `iwr -useb ${CLOUD}/install.ps1 | iex`,
          ],
        ]
      : ["sh", ["-c", `curl -fsSL ${CLOUD}/install.sh | sh`]];

  return await new Promise<number>((resolve) => {
    const p = spawn(cmd[0] as string, cmd[1] as string[], { stdio: "inherit" });
    p.on("error", (err) => {
      console.error("[kumiteos] update failed:", err.message);
      resolve(1);
    });
    p.on("close", (code) => resolve(code ?? 0));
  });
}

// ---- helpers ----

function readPid(): number | null {
  try {
    const raw = fs.readFileSync(PID_FILE, "utf8").trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function stopRunningServer(): Promise<void> {
  // 1. Graceful: PID file → SIGTERM.
  const pid = readPid();
  if (pid && pid !== process.pid) {
    try {
      process.kill(pid, "SIGTERM");
      // Give it ~3 s to wind down.
      for (let i = 0; i < 30; i++) {
        if (!isAlive(pid)) break;
        await sleep(100);
      }
      if (isAlive(pid)) {
        try { process.kill(pid, "SIGKILL"); } catch { /* gone */ }
      }
    } catch {
      // No such pid — stale file.
    }
    try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
  }

  // 2. Fallback: anything still holding port 4747.
  await killByPort(PORT);
}

function isAlive(pid: number): boolean {
  try {
    // Signal 0 only checks for existence; doesn't actually deliver.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killByPort(port: number): Promise<void> {
  try {
    if (process.platform === "win32") {
      // Find PIDs owning the LISTEN socket on `port`.
      const out = execFileSync("powershell", [
        "-NoProfile",
        "-Command",
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -Expand OwningProcess) -join ' '`,
      ]).toString().trim();
      for (const tok of out.split(/\s+/)) {
        const pid = parseInt(tok, 10);
        if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
          try {
            execFileSync("powershell", [
              "-NoProfile",
              "-Command",
              `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`,
            ]);
          } catch { /* swallow */ }
        }
      }
    } else {
      // lsof works on macOS and most Linux installs.
      let out = "";
      try {
        out = execFileSync("lsof", ["-ti", `:${port}`]).toString();
      } catch {
        // lsof returns non-zero when nothing matches — that's fine.
        out = "";
      }
      for (const tok of out.split(/\s+/)) {
        const pid = parseInt(tok, 10);
        if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
          try { process.kill(pid, "SIGTERM"); } catch { /* gone */ }
        }
      }
    }
  } catch {
    // killByPort is best-effort; the waitForPortFree loop reports
    // the real failure if the port stays occupied.
  }
}

async function waitForPortFree(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortFree(port)) return true;
    await sleep(200);
  }
  return await isPortFree(port);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    try {
      srv.listen(port, "127.0.0.1");
    } catch {
      resolve(false);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
