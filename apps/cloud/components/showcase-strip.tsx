// Infinite-loop carousel of the four app screens (check-in → admin →
// private → public). Each frame is a tiny browser window with the
// matching localhost/<screen> URL in the chrome bar. The viewport
// aspect ratio matches the source PNGs (3360 × 2004) so the screenshot
// fills edge-to-edge without crop or letterbox.

const SCREENS = [
  {
    id: "check-in",
    label: "CHECK-IN",
    sub: "Marca a quienes llegaron",
    url: "localhost/check-in",
    src: "/screens/check-in.png",
  },
  {
    id: "admin",
    label: "ADMIN",
    sub: "Marcador en vivo",
    url: "localhost/admin",
    src: "/screens/admin.png",
  },
  {
    id: "private",
    label: "PRIVATE",
    sub: "Pantalla del operador",
    url: "localhost/private",
    src: "/screens/private.png",
  },
  {
    id: "public",
    label: "PUBLIC",
    sub: "Pantalla pública del torneo",
    url: "localhost/public",
    src: "/screens/public.png",
  },
];

export function ShowcaseStrip() {
  // Duplicate the list so the CSS `translateX(-50%)` loop is seamless.
  const track = [...SCREENS, ...SCREENS];

  return (
    <section className="section showcase" id="showcase">
      <div className="section-head">
        <div className="section-num">03</div>
        <div className="section-titles">
          <h2 className="section-title">La app en acción</h2>
          <p className="section-sub">
            Cuatro pantallas. Cada operador (mesa de control, panel privado,
            pantalla pública, check-in) corre la suya en cualquier máquina del
            estadio.
          </p>
        </div>
        <div className="section-meta">4 PANTALLAS · LOOP ∞</div>
      </div>

      <div className="strip" aria-label="App screenshots carousel">
        <div className="strip-track">
          {track.map((s, i) => (
            <figure className="winframe" key={`${s.id}-${i}`}>
              <div className="winframe-bezel">
                <div className="winframe-chrome" aria-hidden>
                  <div className="winframe-dots">
                    <span className="dot-r" />
                    <span className="dot-y" />
                    <span className="dot-g" />
                  </div>
                  <div className="winframe-url">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                    <span>{s.url}</span>
                  </div>
                  <div className="winframe-controls" aria-hidden>
                    <span /><span /><span />
                  </div>
                </div>
                <div className="winframe-view">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.src}
                    alt={`Pantalla ${s.label.toLowerCase()}`}
                    loading={i < SCREENS.length ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                  />
                </div>
              </div>
              <figcaption className="winframe-cap">
                <span className="winframe-cap-n">
                  {String((i % SCREENS.length) + 1).padStart(2, "0")}
                </span>
                <span className="winframe-cap-t">{s.label}</span>
                <span className="winframe-cap-s">{s.sub}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="strip-fade strip-fade-l" aria-hidden />
        <div className="strip-fade strip-fade-r" aria-hidden />
      </div>
    </section>
  );
}
