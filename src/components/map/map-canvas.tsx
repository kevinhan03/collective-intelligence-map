"use client";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RendererConfig } from "@/domain/types";
import type { MapProps } from "./types";
const Kakao = dynamic(() => import("./renderers/kakao"), { ssr: false });
const MapLibre = dynamic(() => import("./renderers/maplibre"), { ssr: false });
const Google = dynamic(() => import("./renderers/google"), { ssr: false });
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
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "240px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [compact]);
  if (config.provider === "preview") return <Preview {...props} apiKey="" />;
  if (!config.key)
    return (
      <div className="map-grid flex h-full min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
        <MapPin className="text-primary" size={32} />
        <p className="font-medium">지도 연결을 준비하고 있어요.</p>
        <p className="max-w-xs text-sm leading-6 text-muted-foreground">
          장소 목록에서 추천 근거와 검증을 확인할 수 있습니다.
        </p>
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
        <Renderer
          {...props}
          apiKey={config.key}
          mapId={config.mapId}
          compact={compact}
        />
      ) : (
        <div className="map-grid flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
          <MapPin className="text-primary" size={28} />
          <p className="text-sm font-medium">지도를 준비하고 있어요.</p>
          <p className="max-w-xs text-xs leading-5 text-muted-foreground">
            이 영역이 화면에 표시되면 지도를 불러옵니다.
          </p>
        </div>
      )}
    </div>
  );
}
