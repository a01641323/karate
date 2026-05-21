"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Arrow, Footer, TopBar } from "@/components/chrome";

export default function RequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/request-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, org, tournamentDate, notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const { requestId, accessToken } = (await res.json()) as {
        requestId: string; accessToken: string;
      };
      router.push(`/pending/${requestId}?key=${encodeURIComponent(accessToken)}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <TopBar />

      <section className="section">
        <div className="section-head">
          <div className="section-num">02</div>
          <div className="section-titles">
            <h2 className="section-title">Solicitar código</h2>
            <p className="section-sub">
              El operador revisa cada solicitud manualmente. Una vez
              aprobada, tu código de activación aparecerá en esta misma
              ventana.
            </p>
          </div>
          <div className="section-meta">CÓDIGO · 6 DÍGITOS</div>
        </div>

        <div className="access-grid">
          <form className="card code-card" onSubmit={submit}>
            <div className="card-head">
              <span className="card-eyebrow">FORMULARIO</span>
              <span className="card-meta">Datos del torneo</span>
            </div>

            <label className="field">
              <span className="field-label">Correo electrónico *</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="tu@correo.com"
                autoComplete="email"
              />
            </label>

            <label className="field">
              <span className="field-label">Organización o dojo</span>
              <input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                className="field-input"
                placeholder="Asociación, federación, dojo..."
              />
            </label>

            <label className="field">
              <span className="field-label">Fecha del torneo</span>
              <input
                type="date"
                value={tournamentDate}
                onChange={(e) => setTournamentDate(e.target.value)}
                className="field-input"
              />
            </label>

            <label className="field">
              <span className="field-label">Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="field-textarea"
                placeholder="Cualquier contexto que ayude a aprobar tu solicitud."
              />
            </label>

            {error && <div className="error-banner">{error}</div>}

            <div className="code-actions" style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? "Enviando…" : "Enviar solicitud"}
                {!submitting && <Arrow />}
              </button>
            </div>
          </form>

          <div className="card sample-card">
            <div className="card-head">
              <span className="card-eyebrow">EJEMPLO</span>
              <span className="card-meta">Cómo se ve tu código</span>
            </div>

            <div className="code-display">
              <span style={{ opacity: 0.4 }}>1</span>
              <span style={{ opacity: 0.55 }}>2</span>
              <span style={{ opacity: 0.7 }}>3</span>
              <span style={{ opacity: 0.7 }}>4</span>
              <span style={{ opacity: 0.55 }}>5</span>
              <span style={{ opacity: 0.4 }}>6</span>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
              <Row k="Formato" v="6 dígitos" />
              <Row k="Validez" v="30 días para activar" />
              <Row k="Sesión" v="24 horas tras activar" />
              <Row k="Máquinas" v="1 por código" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", color: "var(--color-fg-2)", textTransform: "uppercase" }}>{k}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, padding: "3px 8px", background: "color-mix(in oklab, var(--color-fg) 8%, transparent)", color: "var(--color-fg)" }}>{v}</span>
    </div>
  );
}
