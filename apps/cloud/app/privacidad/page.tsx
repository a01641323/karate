import type { Metadata } from "next";
import { Footer, TopBar } from "@/components/chrome";

export const metadata: Metadata = {
  title: "Aviso de Privacidad · Kumite/OS",
  description: "Aviso de privacidad y tratamiento de datos personales de Kumite/OS.",
};

export default function PrivacidadPage() {
  return (
    <div>
      <TopBar />

      <section className="section legal">
        <div className="section-head">
          <div className="section-num">§</div>
          <div className="section-titles">
            <h2 className="section-title">Aviso de Privacidad</h2>
            <p className="section-sub">KUMITE/OS</p>
          </div>
          <div className="section-meta">MAYO 2026</div>
        </div>

        <div className="card legal-body">
          <h3>Responsable del tratamiento</h3>
          <p>
            Kumite/OS · contacto:{" "}
            <a href="mailto:hg.matias.a@gmail.com" className="muted-link">hg.matias.a@gmail.com</a>
          </p>

          <h3>Datos personales que recabamos</h3>
          <p>
            Al solicitar un código de torneo, recabamos tu correo electrónico,
            el nombre de tu organización o dojo, la fecha del torneo, y los
            archivos que decidas cargar (como logotipos y listas de
            competidores).
          </p>

          <h3>Finalidades del tratamiento</h3>
          <p>
            Utilizamos tus datos exclusivamente para procesar tu solicitud,
            asignarte un código de acceso, y contactarte sobre tu torneo. No
            usamos tus datos para publicidad ni fines comerciales ajenos al
            servicio.
          </p>

          <h3>Transferencia de datos</h3>
          <p>
            No compartimos tus datos personales con terceros, salvo obligación
            legal.
          </p>

          <h3>Tiempo de conservación</h3>
          <p>
            Conservamos tus datos mientras tu código de torneo esté activo.
            Puedes solicitar su eliminación en cualquier momento.
          </p>

          <h3>Derechos ARCO</h3>
          <p>
            Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al
            tratamiento de tus datos (derechos ARCO). Para ejercerlos,
            escríbenos a:{" "}
            <a href="mailto:hg.matias.a@gmail.com" className="muted-link">hg.matias.a@gmail.com</a>
          </p>

          <h3>Uso de cookies</h3>
          <p>
            Este sitio utiliza únicamente cookies funcionales necesarias para
            mantener tu sesión activa y recordar tu código de acceso. No usamos
            cookies de rastreo ni publicidad.
          </p>

          <h3>Cambios a este aviso</h3>
          <p>
            Cualquier actualización se publicará en esta página con la fecha de
            modificación.
          </p>

          <p className="legal-updated">Última actualización: mayo 2026</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
