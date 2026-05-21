"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect x="1" y="1" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 8 L14 14 L8 20 M14 14 L20 8 M14 14 L20 20"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="square"
        fill="none"
      />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden>
      <path
        d="M1 7H17M17 7L11 1M17 7L11 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const time = now?.toLocaleTimeString("es-MX", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }) ?? "—";
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <Logo />
          <span className="brand-name">KUMITE/OS</span>
        </Link>
        <nav className="topnav">
          <Link href="/#about">Sistema</Link>
          <Link href="/request">Solicitar</Link>
          <Link href="/download">Descargar</Link>
          <Link href="/#how">Cómo funciona</Link>
        </nav>
        <div className="status">
          <span className="dot" />
          <span className="status-text">{time}</span>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-row">
        <Link href="/" className="brand">
          <Logo />
          <span className="brand-name">KUMITE/OS</span>
        </Link>
        <div className="footer-links">
          <Link href="/request">Solicitar</Link>
          <Link href="/download">Descargar</Link>
          <Link href="/#how">Cómo funciona</Link>
          <a href="https://github.com/a01641323/karate" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="footer-meta">© 2026 · Sistema oficial de torneo</div>
      </div>
      <div className="footer-mark" aria-hidden>KUMITE / OPEN / 2026</div>
    </footer>
  );
}
