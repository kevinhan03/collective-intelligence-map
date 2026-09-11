"use client";
import type { MouseEvent } from "react";

const DURATION_MS = 1400;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function SmoothScrollLink({
  href,
  onClick,
  ...props
}: React.ComponentProps<"a">) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = href?.startsWith("#") ? href.slice(1) : null;
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.scrollIntoView();
      return;
    }
    const startY = window.scrollY;
    const targetY = target.getBoundingClientRect().top + startY;
    const startTime = performance.now();
    function step(now: number) {
      const progress = Math.min((now - startTime) / DURATION_MS, 1);
      window.scrollTo({
        top: startY + (targetY - startY) * easeInOutCubic(progress),
        behavior: "instant",
      });
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  return <a href={href} onClick={handleClick} {...props} />;
}
