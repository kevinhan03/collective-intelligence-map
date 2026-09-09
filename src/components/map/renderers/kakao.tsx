"use client";
import { useEffect, useRef, useState } from "react";
import type { MapProps } from "../types";
type LatLng = { getLat(): number; getLng(): number };
type KMap = { getBounds(): { getNorthEast(): LatLng; getSouthWest(): LatLng } };
type Overlay = { setMap(map: KMap | null): void };
type KakaoMaps = {
  load(fn: () => void): void;
  Map: new (el: HTMLElement, options: object) => KMap;
  LatLng: new (lat: number, lng: number) => LatLng;
  CustomOverlay: new (options: object) => Overlay;
  event: {
    addListener(target: KMap, name: string, fn: () => void): void;
    removeListener(target: KMap, name: string, fn: () => void): void;
  };
};
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}
let loaded: Promise<void> | undefined;
function load(key: string) {
  if (!loaded)
    loaded = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      script.onload = () => window.kakao?.maps.load(resolve);
      script.onerror = () => {
        loaded = undefined;
        reject(new Error("지도 로드 실패"));
      };
      document.head.append(script);
      setTimeout(() => {
        if (!window.kakao?.maps) {
          loaded = undefined;
          reject(new Error("지도 연결 시간 초과"));
        }
      }, 15000);
    });
  return loaded;
}
export default function KakaoMap({
  apiKey,
  places,
  selected,
  onSelect,
  bounds,
  onBoundsChange,
}: MapProps) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<KMap | null>(null),
    pins = useRef<Overlay[]>([]);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const handlers = useRef({ onSelect, onBoundsChange });
  useEffect(() => {
    handlers.current = { onSelect, onBoundsChange };
  }, [onSelect, onBoundsChange]);
  useEffect(() => {
    let active = true;
    let listener: (() => void) | undefined;
    load(apiKey)
      .then(() => {
        if (!active || !el.current || !window.kakao) return;
        const k = window.kakao.maps;
        const instance = new k.Map(el.current, {
          center: new k.LatLng(
            (bounds.north + bounds.south) / 2,
            (bounds.east + bounds.west) / 2,
          ),
          level: 7,
        });
        map.current = instance;
        listener = () => {
          const b = instance.getBounds(),
            ne = b.getNorthEast(),
            sw = b.getSouthWest();
          handlers.current.onBoundsChange({
            north: ne.getLat(),
            east: ne.getLng(),
            south: sw.getLat(),
            west: sw.getLng(),
          });
        };
        k.event.addListener(instance, "idle", listener);
        setReady(true);
      })
      .catch(() =>
        setError("지도를 불러오지 못했습니다. 장소 목록을 이용해 주세요."),
      );
    return () => {
      active = false;
      if (map.current && listener)
        window.kakao?.maps.event.removeListener(map.current, "idle", listener);
      pins.current.forEach((p) => p.setMap(null));
    };
  }, [apiKey, bounds.north, bounds.south, bounds.east, bounds.west]);
  useEffect(() => {
    if (!ready || !map.current || !window.kakao) return;
    const k = window.kakao.maps;
    pins.current.forEach((p) => p.setMap(null));
    pins.current = places.map((p, i) => {
      const button = document.createElement("button");
      button.className = "map-pin";
      button.dataset.selected = String(selected === p.id);
      button.setAttribute("aria-label", p.name);
      const span = document.createElement("span");
      span.textContent = String(i + 1);
      button.append(span);
      button.onclick = () => handlers.current.onSelect(p.id);
      return new k.CustomOverlay({
        map: map.current,
        position: new k.LatLng(p.lat, p.lng),
        content: button,
      });
    });
  }, [ready, places, selected]);
  return (
    <div className="relative h-full min-h-[420px]">
      <div ref={el} className="absolute inset-0" />
      {error && (
        <p
          role="alert"
          className="absolute inset-x-4 top-4 rounded bg-card p-4 text-sm"
        >
          {error}
        </p>
      )}
    </div>
  );
}
