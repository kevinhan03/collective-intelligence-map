"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function ScrollHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mapRoute = /^\/maps\/[^/]+\/?$/.test(pathname);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header
      data-map-route={mapRoute}
      data-scrolled={scrolled}
      className="glass-panel glass-header sticky top-3 z-30"
    >
      {children}
    </header>
  );
}
