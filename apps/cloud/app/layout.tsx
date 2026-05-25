import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kumite/OS · Sistema óptimo para torneos",
  description: "Desde tu navegador. Todo conectado.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
