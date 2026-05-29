"use client";

// Client-only motion controller for the landing page. Responsibilities:
//   1. Split hero title lines into per-letter spans so CSS can stagger
//      the `letter-resolve` blur-rise keyframe.
//   2. Tag scroll targets with `.reveal` and toggle `.in` via an
//      IntersectionObserver, driving the clip-wipe reveal in globals.css.
//      When a `.section-head` reveals, its `.section-num` scrambles in.
//   3. Pointer-driven effects (fine-pointer devices only): magnetic CTA
//      with spotlight + click ripple, a cursor-tracked spotlight mask on
//      the hero grid, and 3D tilt on `[data-tilt]` elements.
//   4. Release the body fade-gate by adding `loaded` to <html>.
//
// Honours prefers-reduced-motion: skips the split, observer, and all
// pointer effects (CSS already short-circuits the keyframes).

import { useEffect } from "react";

export function RevealClient() {
  useEffect(() => {
    document.documentElement.classList.add("loaded");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const cleanups: Array<() => void> = [];

    // --- 1. Per-letter split for hero title lines ---------------------
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

    // --- 2. Scroll reveal + section-number scramble ------------------
    const targets = document.querySelectorAll<HTMLElement>(
      ".section-head, .card, .step, .about-lead, .strip, .footer-mark",
    );
    targets.forEach((el) => el.classList.add("reveal"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          if (e.target.classList.contains("section-head")) {
            const num = e.target.querySelector<HTMLElement>(".section-num");
            if (num) scramble(num);
          }
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    // --- 3. Pointer effects (fine pointer + hover only) -------------
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      cleanups.push(magneticCta());
      cleanups.push(heroGridSpotlight());
      cleanups.push(tiltElements());
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}

// Briefly cycles random digits before settling on the final number.
function scramble(el: HTMLElement) {
  const final = el.textContent ?? "";
  const glyphs = "0123456789";
  const total = 16;
  let frame = 0;
  const id = window.setInterval(() => {
    frame++;
    el.textContent = [...final]
      .map((c, i) =>
        frame / total > i / final.length + 0.25
          ? c
          : glyphs[Math.floor(Math.random() * glyphs.length)],
      )
      .join("");
    if (frame >= total) {
      window.clearInterval(id);
      el.textContent = final;
    }
  }, 40);
}

// Pulls the hero CTA toward the cursor, feeds the pointer position to the
// spotlight (--gx/--gy), and spawns a ripple on click.
function magneticCta(): () => void {
  const cta = document.querySelector<HTMLElement>(".hero-cta");
  if (!cta) return () => {};
  const strength = 0.28;
  let raf = 0;

  const onMove = (e: PointerEvent) => {
    const r = cta.getBoundingClientRect();
    cta.style.setProperty("--gx", `${e.clientX - r.left}px`);
    cta.style.setProperty("--gy", `${e.clientY - r.top}px`);
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      cta.style.transform = `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)`;
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(raf);
    cta.style.transform = "";
  };
  const onDown = (e: PointerEvent) => {
    const r = cta.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "cta-ripple";
    ripple.style.left = `${e.clientX - r.left}px`;
    ripple.style.top = `${e.clientY - r.top}px`;
    ripple.addEventListener("animationend", () => ripple.remove());
    cta.appendChild(ripple);
  };

  cta.addEventListener("pointermove", onMove);
  cta.addEventListener("pointerleave", onLeave);
  cta.addEventListener("pointerdown", onDown);
  return () => {
    cancelAnimationFrame(raf);
    cta.removeEventListener("pointermove", onMove);
    cta.removeEventListener("pointerleave", onLeave);
    cta.removeEventListener("pointerdown", onDown);
  };
}

// Eases the hero-grid spotlight mask center toward the cursor.
function heroGridSpotlight(): () => void {
  const hero = document.querySelector<HTMLElement>(".hero");
  const grid = document.querySelector<HTMLElement>(".hero-grid");
  if (!hero || !grid) return () => {};
  let tx = 70, ty = 40, cx = 70, cy = 40, raf = 0, running = false;

  const loop = () => {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    grid.style.setProperty("--mx", `${cx.toFixed(2)}%`);
    grid.style.setProperty("--my", `${cy.toFixed(2)}%`);
    if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
      raf = requestAnimationFrame(loop);
    } else {
      running = false;
    }
  };
  const start = () => {
    if (!running) {
      running = true;
      raf = requestAnimationFrame(loop);
    }
  };
  const onMove = (e: PointerEvent) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width) * 100;
    ty = ((e.clientY - r.top) / r.height) * 100;
    start();
  };
  const onLeave = () => {
    tx = 70;
    ty = 40;
    start();
  };

  hero.addEventListener("pointermove", onMove);
  hero.addEventListener("pointerleave", onLeave);
  return () => {
    cancelAnimationFrame(raf);
    hero.removeEventListener("pointermove", onMove);
    hero.removeEventListener("pointerleave", onLeave);
  };
}

// Cursor-tracked 3D tilt for any [data-tilt] element.
function tiltElements(): () => void {
  const els = document.querySelectorAll<HTMLElement>("[data-tilt]");
  const max = 8;
  const offs: Array<() => void> = [];

  els.forEach((el) => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    offs.push(() => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    });
  });

  return () => offs.forEach((fn) => fn());
}
