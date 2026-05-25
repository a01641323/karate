"use client";

// Tiny client-only effect that:
//   1. Splits hero title lines into per-letter spans so CSS can
//      stagger them with `letter-rise` keyframes.
//   2. Tags scroll targets with `.reveal` and toggles `.in` once
//      they cross the viewport, driving the fade-up keyframe set
//      in globals.css.
//   3. Adds `loaded` to <html> so the body's opacity transition
//      kicks in on first paint.
//
// Honours prefers-reduced-motion: skips the split + observer
// (CSS already shortcircuits the keyframes for those users).

import { useEffect } from "react";

export function RevealClient() {
  useEffect(() => {
    document.documentElement.classList.add("loaded");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Per-letter split for hero title lines.
    document.querySelectorAll<HTMLElement>(".hero-title-line").forEach((line) => {
      if (line.dataset.split) return;
      const text = line.textContent ?? "";
      line.dataset.split = "1";
      line.innerHTML = "";
      [...text].forEach((ch, k) => {
        const span = document.createElement("span");
        span.className = "letter";
        span.style.setProperty("--i", String(k));
        span.textContent = ch === " " ? " " : ch;
        line.appendChild(span);
      });
    });

    // Reveal targets — keep selector list narrow so we don't
    // accidentally hide important content if anything misfires.
    const targets = document.querySelectorAll<HTMLElement>(
      ".section-head, .card, .step, .about-lead, .strip, .footer-mark, .hero-foot",
    );
    targets.forEach((el) => el.classList.add("reveal"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
