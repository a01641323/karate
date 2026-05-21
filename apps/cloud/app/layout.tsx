import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kumite/OS · Sistema digital de torneo",
  description: "Solicita un código, descarga la app, corre tu torneo de karate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
