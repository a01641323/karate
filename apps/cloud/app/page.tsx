import Link from "next/link";
import { Arrow, Footer, TopBar } from "@/components/chrome";
import { ShowcaseStrip } from "@/components/showcase-strip";
import { RevealClient } from "@/components/reveal-client";

export default function LandingPage() {
  return (
    <div>
      <RevealClient />
      <TopBar />

      <section className="hero">
        <div className="hero-grid" aria-hidden />

        <div className="hero-meta">
          <span className="tag">
            <span className="tag-dot" /> EDICIÓN 2026
          </span>
          <span className="tag-line">SISTEMA DIGITAL DE TORNEO</span>
        </div>

        <h1 className="hero-title">
          <span className="hero-title-line">KUMITE</span>
          <span className="hero-title-line outline">OPEN</span>
        </h1>

        <div className="kanji" aria-hidden>空手</div>

        <div className="hero-foot">
          <Link href="/request" className="hero-cta">
            <span>Solicitar código</span>
            <Arrow />
          </Link>
        </div>
      </section>

      <AboutSection />
      <ShowcaseStrip />
      <HowItWorksSection />

      <Footer />
    </div>
  );
}

function AboutSection() {
  return (
    <section className="section" id="about">
      <div className="section-head">
        <div className="section-num">01</div>
        <div className="section-titles">
          <h2 className="section-title">Sobre el sistema</h2>
        </div>
        <div className="section-meta">PLATAFORMA DIGITAL</div>
      </div>

      <div className="about-grid">
        <p className="about-lead">
          Un sistema digital de scoring para torneos de karate. Solicita un
          código aquí, descarga la app, y corre tu torneo durante 24 horas en
          tu propia máquina — sin internet, sin papel, sin servidores
          externos.
        </p>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      t: "Solicita un código",
      d: "Llena el formulario con tu correo y fecha de torneo. El operador revisa la solicitud.",
    },
    {
      n: "02",
      t: "Recibe la aprobación",
      d: "Una vez aprobado, tu código de 6 dígitos aparece automáticamente en tu pantalla de espera.",
    },
    {
      n: "03",
      t: "Descarga la app",
      d: "Un solo archivo ejecutable para tu sistema operativo: macOS, Windows o Linux.",
    },
    {
      n: "04",
      t: "Pega el código",
      d: "Ejecuta la app, abre http://localhost:4747 en tu navegador y pega el código. 24 horas de torneo.",
    },
  ];
  return (
    <section className="section" id="how">
      <div className="section-head">
        <div className="section-num">02</div>
        <div className="section-titles">
          <h2 className="section-title">Cómo funciona</h2>
          <p className="section-sub">Cuatro pasos. Cero papel.</p>
        </div>
        <div className="section-meta">~ 5 MIN DE SETUP</div>
      </div>

      <div className="steps">
        {steps.map((s, i) => (
          <div className="step" key={s.n}>
            <div className="step-n">{s.n}</div>
            <div className="step-body">
              <div className="step-t">{s.t}</div>
              <div className="step-d">{s.d}</div>
            </div>
            {i < steps.length - 1 && <div className="step-arrow"><Arrow /></div>}
          </div>
        ))}
      </div>
    </section>
  );
}
