"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Arrow, Footer, TopBar } from "@/components/chrome";

type Status =
  | { status: "pending"; createdAt: number }
  | { status: "granted"; code: string | null; ttlHours: number | null; expiresAt: number | null }
  | { status: "rejected"; rejectionReason: string | null };

const POLL_MS = 5000;

export default function PendingPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const search = useSearchParams();
  const key = search.get("key");
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const url = `/api/requests/${encodeURIComponent(requestId)}/status${
          key ? `?key=${encodeURIComponent(key)}` : ""
        }`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          setError(res.status === 401 ? "Esta página es privada. Abre el enlace original." : `HTTP ${res.status}`);
          return;
        }
        const j = (await res.json()) as Status;
        if (stopped) return;
        setData(j);
        if (j.status === "pending") timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (!stopped) setError((err as Error).message);
      }
    }
    tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [requestId, key]);

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const statusLabel =
    data?.status === "pending" ? "Esperando aprobación" :
    data?.status === "granted" ? "✓ Aprobado" :
    data?.status === "rejected" ? "✗ Rechazado" :
    "Cargando…";
  const statusClass =
    data?.status === "pending" ? "status-checking" :
    data?.status === "granted" ? "status-success" :
    data?.status === "rejected" ? "status-error" :
    "status-checking";

  return (
    <div>
      <TopBar />

      <section className="section">
        <div className="section-head">
          <div className="section-num">03</div>
          <div className="section-titles">
            <h2 className="section-title">Tu solicitud</h2>
            <p className="section-sub">
              Marca esta página o copia su URL — tu código aparecerá aquí
              cuando el operador apruebe la solicitud.
            </p>
          </div>
          <div className="section-meta">{statusLabel.toUpperCase()}</div>
        </div>

        {error && (
          <div className="card" style={{ borderColor: "color-mix(in oklab, var(--color-accent) 50%, var(--color-line))" }}>
            <div className="card-head">
              <span className="card-eyebrow">ERROR</span>
            </div>
            <p style={{ color: "var(--color-fg)" }}>{error}</p>
          </div>
        )}

        {!error && !data && (
          <div className="card">
            <div className="card-head">
              <span className="card-eyebrow">CARGANDO</span>
              <span className="card-meta">Consultando estado…</span>
            </div>
            <p style={{ color: "var(--color-fg-2)" }}>Un momento.</p>
          </div>
        )}

        {data?.status === "pending" && (
          <div className="card">
            <div className="card-head">
              <span className="card-eyebrow">EN COLA</span>
              <span className={`card-status ${statusClass}`}>{statusLabel}</span>
            </div>
            <div className="code-display" style={{ opacity: 0.4 }}>
              <span>•</span><span>•</span><span>•</span><span>•</span><span>•</span><span>•</span>
            </div>
            <p style={{ marginTop: 20, color: "var(--color-fg-2)", fontSize: 14 }}>
              Revisamos las solicitudes manualmente. Refresco automático cada 5 segundos —
              también puedes recargar la página en cualquier momento.
            </p>
          </div>
        )}

        {data?.status === "granted" && data.code && (
          <div className="card" style={{ borderColor: "color-mix(in oklab, var(--color-success) 40%, var(--color-line))" }}>
            <div className="card-head">
              <span className="card-eyebrow">CÓDIGO DE ACTIVACIÓN</span>
              <span className={`card-status ${statusClass}`}>{statusLabel}</span>
            </div>

            <div className="code-display">
              {data.code.split("").map((d, i) => (
                <span key={i} className="digit">{d}</span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
              <button className="btn primary" onClick={() => copyCode(data.code!)}>
                {copied ? "Copiado ✓" : "Copiar código"}
              </button>
              <Link href="/download" className="btn ghost">
                Descargar la app <Arrow />
              </Link>
            </div>

            <div className="success-banner">
              <div className="success-line">
                <span>Sesión válida por</span>
                <strong>{data.ttlHours ?? 24} horas</strong>
                <span style={{ color: "var(--color-fg-2)" }}>después de activar.</span>
              </div>
              <div className="success-line small">
                Código de un solo uso · se bloquea a la primera máquina que lo redima.
              </div>
            </div>
          </div>
        )}

        {data?.status === "granted" && !data.code && (
          <div className="card" style={{ borderColor: "color-mix(in oklab, var(--color-accent) 40%, var(--color-line))" }}>
            <div className="card-head">
              <span className="card-eyebrow">CÓDIGO REVOCADO</span>
              <span className="card-status status-error">No disponible</span>
            </div>
            <p style={{ color: "var(--color-fg-2)" }}>
              El operador revocó este código. Contacta para entender el motivo.
            </p>
          </div>
        )}

        {data?.status === "rejected" && (
          <div className="card" style={{ borderColor: "color-mix(in oklab, var(--color-accent) 50%, var(--color-line))" }}>
            <div className="card-head">
              <span className="card-eyebrow">RECHAZADO</span>
              <span className={`card-status ${statusClass}`}>{statusLabel}</span>
            </div>
            {data.rejectionReason ? (
              <p style={{ color: "var(--color-fg)" }}>{data.rejectionReason}</p>
            ) : (
              <p style={{ color: "var(--color-fg-2)" }}>
                Tu solicitud no fue aprobada. Puedes enviar una nueva desde{" "}
                <Link href="/request" style={{ textDecoration: "underline" }}>aquí</Link>.
              </p>
            )}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
