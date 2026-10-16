"use client";
import { useLayoutEffect, useRef } from "react";

/** Fit the complete sentence to its available width, including after font load. */
export function SingleLineText({
  children,
  className = "",
  maxFontSize = 14,
}: {
  children: string;
  className?: string;
  maxFontSize?: number;
}) {
  const container = useRef<HTMLParagraphElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = container.current;
    const content = text.current;
    if (!element || !content) return;
    const fit = () => {
      const available = element.clientWidth;
      if (!available) return;
      element.style.fontSize = `${maxFontSize}px`;
      const natural = content.getBoundingClientRect().width;
      if (natural > available)
        element.style.fontSize = `${Math.floor(((maxFontSize * available) / natural) * 100) / 100}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [children, maxFontSize]);
  return (
    <p
      ref={container}
      className={`single-line-text ${className}`}
      style={{ fontSize: maxFontSize }}
    >
      <span ref={text}>{children}</span>
    </p>
  );
}
