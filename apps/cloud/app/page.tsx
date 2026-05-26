import Link from "next/link";
import { Arrow, Footer, TopBar } from "@/components/chrome";
import { ShowcaseStrip } from "@/components/showcase-strip";
import { RevealClient } from "@/components/reveal-client";

export default function LandingPage() {
  return (
    <div>
      {/* Inline script runs before paint and gates the body opacity-0 fade-in
          ONLY on the landing page. RevealClient then releases the gate by
          adding `loaded` after mount. Other routes never set `fade-gate`,
          so they render visibly on direct navigation. */}
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.classList.add('fade-gate')",
        }}
      />
      <RevealClient />
      <TopBar />

      <section className="hero">
        <div className="hero-grid" aria-hidden />

        <div className="hero-meta">
          <span className="tag">
            <span className="tag-dot" /> EDICIÓN 2026
          </span>
          <span className="tag-line">SISTEMA ÓPTIMO PARA TORNEOS</span>
        </div>

        <h1 className="hero-title">
          <span className="hero-title-line">KUMITE</span>
          <span className="hero-title-line outline">OPTIMAL SYSTEM</span>
        </h1>

        <div className="kanji" aria-hidden>組手</div>

        <div className="hero-foot">
          <Link href="/request" className="hero-cta">
            <span>Solicitar código</span>
            <Arrow />
          </Link>
        </div>
      </section>

      <AboutSection />
      <HowItWorksSection />
      <ShowcaseStrip />

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
          <h2 className="section-title">¿Qué ofrecemos?</h2>
        </div>
        <div className="section-meta">PLATAFORMA DIGITAL</div>
      </div>

      <div className="about-grid">
        <p className="about-lead">
          No desperdicies el tiempo. Todo conectado.
          Solo haz click y anota los puntos. Nosotros nos encargamos del resto.
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
      d: "Llena el formulario con tu información, personaliza tu torneo y adquiere tu código.",
    },
    {
      n: "02",
      t: "Descarga la app",
      d: "Elige tu sistema operativo y ejecuta el descargable desde tu terminal.",
    },
    {
      n: "03",
      t: "¡Entra!",
      d: "Ahora podrás usar el comando kumiteos para abrir la app e ingresar tu código de torneo.",
    },
    {
      n: "04",
      t: "Conecta a tu equipo",
      d: "Usa la liga en la parte superior de tu pantalla para unirte sin descargas",
    },
  ];
  return (
    <section className="section" id="how">
      <div className="section-head">
        <div className="section-num">02</div>
        <div className="section-titles">
          <h2 className="section-title">Primeros pasos</h2>
          <p className="section-sub">Todo en tu navegador</p>
        </div>
        <div className="section-meta">~ EMPIEZA YA</div>
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
