"use client";
import { MapErrorBoundary, MapFailure } from "./map-failure";
import dynamic from "next/dynamic";
import { MapLoading } from "./map-loading";
import { useEffect, useRef, useState } from "react";
import type { RendererConfig } from "@/domain/types";
import type { MapProps } from "./types";
const Kakao = dynamic(() => import("./renderers/kakao"), { ssr: false, loading: MapLoading });
const MapLibre = dynamic(() => import("./renderers/maplibre"), { ssr: false, loading: MapLoading });
const Google = dynamic(() => import("./renderers/google"), { ssr: false, loading: MapLoading });
const Preview = dynamic(() => import("./renderers/preview"), { ssr: false });
export function MapCanvas({
  config,
  compact,
  ...props
}: Omit<MapProps, "apiKey"> & { config: RendererConfig }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(compact);
  useEffect(() => {
    if (compact || !container.current) return;
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => setVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // Let the place list paint before downloading and parsing the renderer.
        if (typeof window.requestIdleCallback === "function") {
          idleId = window.requestIdleCallback(load, { timeout: 500 });
        } else {
          timer = setTimeout(load, 0);
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [compact]);
  if (config.provider === "preview")
    return (
      <MapErrorBoundary onFallback={props.onFallback}>
        <Preview {...props} apiKey="" />
      </MapErrorBoundary>
    );
  if (!config.key)
    return (
      <div className="map-grid flex h-full min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
        <MapFailure
          message="지도 연결을 준비하고 있어요."
          onFallback={props.onFallback}
        />
      </div>
    );
  const Renderer =
    config.provider === "maplibre"
      ? MapLibre
      : config.provider === "kakao"
        ? Kakao
        : Google;
  return (
    <div ref={container} className="h-full min-h-[inherit]">
      {visible ? (
        <MapErrorBoundary onFallback={props.onFallback}>
          <Renderer
            {...props}
            apiKey={config.key}
            mapId={config.mapId}
            compact={compact}
          />
        </MapErrorBoundary>
      ) : (
        <MapLoading />
      )}
    </div>
  );
}
