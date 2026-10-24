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
      // CSS widths stay stable while a sheet is scaled by its animation.
      // Leave one pixel for integer rounding and font rasterization differences.
      const available = element.clientWidth - 1;
      if (available <= 0) return;
      element.style.fontSize = `${maxFontSize}px`;
      if (content.scrollWidth <= available) return;
      let lower = 0;
      let upper = maxFontSize;
      for (let step = 0; step < 10; step++) {
        const size = (lower + upper) / 2;
        element.style.fontSize = `${size}px`;
        if (content.scrollWidth <= available) lower = size;
        else upper = size;
      }
      element.style.fontSize = `${Math.floor(lower * 100) / 100}px`;
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
