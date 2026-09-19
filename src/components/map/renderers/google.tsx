"use client";
import { useEffect, useRef, useState } from "react";
import type { MapProps } from "../types";
let loaded: Promise<void> | undefined;
// This is the local fallback while a Cloud Map Style / Map ID is not configured.
// Keep its contrast intentionally low so place pins and the map's surrounding
// glass surfaces carry the visual hierarchy.
const minimalStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#151713" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8d9384" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#151713" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#2a2e27" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b9c1ae" }],
  },
  { featureType: "landscape", stylers: [{ color: "#171a15" }] },
  {
    featureType: "landscape",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#30352d" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#3a4034" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#464d3d" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#111d1e" }] },
];
function load(key: string) {
  if (window.google?.maps) return Promise.resolve();
  if (!loaded)
    loaded = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=collectiveGoogleReady`;
      window.collectiveGoogleReady = () => resolve();
      script.onerror = () => {
        loaded = undefined;
        reject(new Error("지도 로드 실패"));
      };
      document.head.append(script);
      setTimeout(() => {
        if (!window.google?.maps) {
          loaded = undefined;
          reject(new Error("지도 연결 시간 초과"));
        }
      }, 15000);
    });
  return loaded;
}
declare global {
  interface Window {
    collectiveGoogleReady?: () => void;
  }
}
export default function GoogleMap({
  apiKey,
  places,
  selected,
  onSelect,
  onFocusComplete,
  focusRequest = 0,
  bounds,
  onBoundsChange,
  mapId,
  compact = false,
}: MapProps) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const handlers = useRef({ onSelect, onBoundsChange, onFocusComplete });
  useEffect(() => {
    handlers.current = { onSelect, onBoundsChange, onFocusComplete };
  }, [onSelect, onBoundsChange, onFocusComplete]);
  useEffect(() => {
    let active = true;
    let listener: google.maps.MapsEventListener | undefined;
    let resizeObserver: ResizeObserver | undefined;
    load(apiKey)
      .then(() => {
        if (!active || !el.current) return;
        map.current = new google.maps.Map(el.current, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          ...(mapId
            ? { mapId }
            : {
                renderingType: google.maps.RenderingType.RASTER,
                styles: minimalStyle,
              }),
        });
        const instance = map.current;
        resizeObserver = new ResizeObserver(([entry]) => {
          if (!entry.contentRect.width || !entry.contentRect.height) return;
          const center = instance.getCenter();
          google.maps.event.trigger(instance, "resize");
          if (center) instance.setCenter(center);
        });
        resizeObserver.observe(el.current);
        // Fit to the map's configured region on first load instead of a fixed
        // zoom, so a city-scoped map (Tokyo) and a country-scoped map (Korea)
        // both open showing their whole area rather than a random midpoint.
        map.current.fitBounds({
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
        });
        listener = map.current.addListener("idle", () => {
          const b = map.current?.getBounds();
          if (b) {
            const ne = b.getNorthEast(),
              sw = b.getSouthWest();
            handlers.current.onBoundsChange({
              north: ne.lat(),
              east: ne.lng(),
              south: sw.lat(),
              west: sw.lng(),
            });
          }
        });
        setReady(true);
      })
      .catch(() =>
        setError(
          "지도를 불러오지 못했습니다. 장소 목록은 계속 이용할 수 있습니다.",
        ),
      );
    return () => {
      active = false;
      listener?.remove();
      resizeObserver?.disconnect();
      markers.current.forEach((m) => m.setMap(null));
    };
  }, [apiKey, mapId, bounds.north, bounds.south, bounds.east, bounds.west]);
  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = places.map((p, i) => {
      const marker = new google.maps.Marker({
        map: map.current,
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        label: {
          text: String(i + 1),
          color: selected === p.id ? "#ffffff" : p.status === "pending" ? "#475569" : "#ffffff",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected === p.id ? 19 : 15,
          fillColor: selected === p.id ? "#f97316" : p.status === "pending" ? "#d1d5db" : "#23614a",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 3,
        },
      });
      marker.addListener("click", () => handlers.current.onSelect(p.id));
      return marker;
    });
  }, [ready, places, selected]);
  useEffect(() => {
    if (!ready || !map.current || !selected || focusRequest === 0) return;
    const place = places.find((item) => item.id === selected);
    if (!place) return;
    const start = map.current.getCenter();
    const startLat = start?.lat() ?? place.lat;
    const startLng = start?.lng() ?? place.lng;
    const startZoom = map.current.getZoom() ?? 12;
    const targetZoom = Math.max(startZoom, 14);
    const startedAt = performance.now();
    const duration = 420;
    let frame = 0;
    let zoomTimer: number | undefined;
    let finalIdle: google.maps.MapsEventListener | undefined;
    const animatePan = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      map.current?.setCenter({
        lat: startLat + (place.lat - startLat) * eased,
        lng: startLng + (place.lng - startLng) * eased,
      });
      if (progress < 1) {
        frame = window.requestAnimationFrame(animatePan);
        return;
      }
      let zoom = startZoom;
      const zoomByOneStep = () => {
        const activeMap = map.current;
        if (!activeMap) return;
        if (zoom >= targetZoom) {
          zoomTimer = window.setTimeout(
            () => handlers.current.onFocusComplete?.(place.id),
            140,
          );
          return;
        }
        zoom = Math.min(zoom + 1, targetZoom);
        if (zoom === targetZoom) {
          finalIdle = google.maps.event.addListenerOnce(
            activeMap,
            "idle",
            () => {
              zoomTimer = window.setTimeout(
                () => handlers.current.onFocusComplete?.(place.id),
                140,
              );
            },
          );
        }
        activeMap.setZoom(zoom);
        if (zoom < targetZoom)
          zoomTimer = window.setTimeout(zoomByOneStep, 240);
      };
      zoomTimer = window.setTimeout(zoomByOneStep, 180);
    };
    frame = window.requestAnimationFrame(animatePan);
    return () => {
      window.cancelAnimationFrame(frame);
      if (zoomTimer) window.clearTimeout(zoomTimer);
      finalIdle?.remove();
    };
  }, [ready, places, selected, focusRequest]);
  return (
    <div
      className={`relative h-full ${compact ? "min-h-[240px]" : "min-h-[420px]"}`}
    >
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
