import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Karate Tournament",
  description: "Request a tournament token and run the app locally.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
