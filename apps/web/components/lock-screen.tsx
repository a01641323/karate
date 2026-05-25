"use client";

import { useCallback, useEffect, useState } from "react";
import type { LicenseDegradedReason } from "@karate/core";
import type { DiscoveredServer } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { GuestWaitingScreen } from "./guest-waiting-screen";

// Single generic message for every termination reason.
// The customer should not know whether they expired naturally, were
// revoked by the admin, or hit a clock/signature problem — those
// distinctions are operator-internal. They get one clear message and
// one path: request a fresh code at kumiteos.vercel.app.
const GENERIC_COPY = {
  title: "Tu código expiró",
  body: "Solicita uno nuevo en kumiteos.vercel.app/request.",
} as const;
const REASON_COPY: Record<LicenseDegradedReason, { title: string; body: string }> = {
  EXPIRED: GENERIC_COPY,
  REVOKED: GENERIC_COPY,
  MACHINE_MISMATCH: GENERIC_COPY,
  CLOCK_TAMPER: GENERIC_COPY,
  INVALID_SIGNATURE: GENERIC_COPY,
  STORAGE_CORRUPTED: GENERIC_COPY,
};

type JoinTarget = { serverId: string | null; ip: string; port: number; label: string };

const JOIN_ERROR_COPY: Record<string, string> = {
  denied: "The host rejected the connection.",
  timeout: "The host did not respond in time.",
  host_unlicensed: "The host needs to activate its license before guests can join.",
  connect_failed: "Could not reach the host. Check the IP and that the host is running.",
  network_unavailable: "Network features are only available in the desktop app.",
  set_mode_failed: "Could not switch to client mode.",
};

export function LockScreen({ reason }: { reason: LicenseDegradedReason | string }) {
  const { redeemCode, joinAsGuest } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const isElectron = typeof window !== "undefined" && !!window.__KARATE__?.network;
  const [discovered, setDiscovered] = useState<DiscoveredServer[]>([]);
  const [joining, setJoining] = useState<JoinTarget | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    const net = window.__KARATE__?.network;
    if (!net) return;
    let cancelled = false;
    const refresh = () => {
      net.listDiscoveredServers().then((list) => {
        if (!cancelled) setDiscovered(list);
      }).catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isElectron]);

  const startJoin = useCallback(async (target: JoinTarget) => {
    setJoinError(null);
    setJoining(target);
    try {
      await joinAsGuest(target.serverId ? target.serverId : { ip: target.ip, port: target.port });
    } catch (err) {
      const c = err instanceof Error ? err.message : "connect_failed";
      setJoinError(JOIN_ERROR_COPY[c] ?? `Could not join: ${c}`);
      setJoining(null);
    }
  }, [joinAsGuest]);

  async function handleReset() {
    const license = typeof window !== "undefined" ? window.__KARATE__?.license : null;
    if (!license) return;
    setResetting(true);
    try { await license.reset(); } finally { setResetting(false); }
  }

  const info = REASON_COPY[reason as LicenseDegradedReason] ?? GENERIC_COPY;

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Ingresa un código de 6 dígitos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await redeemCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate");
    } finally {
      setLoading(false);
    }
  }

  if (joining) {
    return <GuestWaitingScreen target={joining} onCancel={() => setJoining(null)} />;
  }

  return (
    <div className="auth-screen">
      <div className="auth-card auth-locked">
        <h1>{info.title}</h1>
        <p>{info.body}</p>

        <form onSubmit={handleRedeem} style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="code-slots-wrap">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="code-slots-input"
              aria-label="6-digit access code"
            />
            <div className="code-slots" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`code-slot ${code[i] ? "filled" : ""} ${i === code.length ? "active" : ""}`}
                >
                  {code[i] ?? ""}
                </div>
              ))}
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="primary"
            disabled={loading || code.length !== 6}
            style={{ width: "100%", padding: "14px 16px", fontSize: 15 }}
          >
            {loading ? "Activando…" : "Activar"}
          </button>
        </form>

        {isElectron && (
          <>
            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span>or join a host</span>
              <span className="auth-divider-line" />
            </div>

            {joinError && <div className="auth-error">{joinError}</div>}

            {discovered.length > 0 ? (
              <ul className="host-list">
                {discovered.map((s) => (
                  <li key={s.serverId} className="host-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="host-name">{s.tournamentName || "Karate Host"}</div>
                      <div className="host-addr">{s.serverIp}:{s.serverPort}</div>
                    </div>
                    <button
                      type="button"
                      className="primary"
                      onClick={() =>
                        startJoin({
                          serverId: s.serverId,
                          ip: s.serverIp,
                          port: s.serverPort,
                          label: s.tournamentName || s.serverIp,
                        })
                      }
                    >
                      Connect
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                Looking for hosts on your network…
              </p>
            )}


            <div className="host-reset-row">
              <button
                type="button"
                className="host-reset"
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? "Clearing…" : "Clear stored license and start over"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
