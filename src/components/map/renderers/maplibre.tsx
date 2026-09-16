"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ensureMapLibreWorkerReady } from "./maplibre-worker";
import type { MapProps } from "../types";

// MapTiler's basemap includes POI symbols (shops, hotels and stations). They
// are not places that this community has added, so keep the basemap's roads and
// labels while removing only its POI symbol layers.
function hideBasemapPoiLayers(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== "symbol" || layer["source-layer"] !== "poi") continue;
    map.setLayoutProperty(layer.id, "visibility", "none");
  }
}

function boundsMatch(a: MapProps["bounds"], b: MapProps["bounds"]) {
  const tolerance = 0.000001;
  return (
    Math.abs(a.north - b.north) < tolerance &&
    Math.abs(a.east - b.east) < tolerance &&
    Math.abs(a.south - b.south) < tolerance &&
    Math.abs(a.west - b.west) < tolerance
  );
}

export default function MapLibreMap(props: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<maplibregl.Map | null>(null);
  const latest = useRef(props);
  const lastReportedBounds = useRef<MapProps["bounds"] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (!container.current) return;
    ensureMapLibreWorkerReady();
    const b = latest.current.bounds;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: props.apiKey,
        bounds: [
          [b.west, b.south],
          [b.east, b.north],
        ],
        fitBoundsOptions: { padding: 35 },
        attributionControl: {},
      });
    } catch {
      queueMicrotask(() => setError(true));
      return;
    }
    instance.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => hideBasemapPoiLayers(map));
    map.on("error", () => setError(true));
    map.on("idle", () => setError(false));
    map.on("moveend", () => {
      const v = map.getBounds();
      const nextBounds = {
        west: Math.max(-180, v.getWest()),
        east: Math.min(180, v.getEast()),
        south: v.getSouth(),
        north: v.getNorth(),
      };
      if (lastReportedBounds.current && boundsMatch(lastReportedBounds.current, nextBounds)) {
        return;
      }
      lastReportedBounds.current = nextBounds;
      latest.current.onBoundsChange(nextBounds);
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      map.remove();
      instance.current = null;
    };
  }, [props.apiKey]);
  useEffect(() => {
    const map = instance.current;
    if (!map) return;
    const markers = props.places.map((p) => {
      const button = document.createElement("button");
      button.type = "button";
      button.title = p.name;
      button.setAttribute(
        "aria-label",
        `${p.name}${p.status === "pending" ? " · 검토 대기" : ""}`,
      );
      button.className = "map-marker";
      button.dataset.selected = String(props.selected === p.id);
      button.dataset.status = p.status;
      const face = document.createElement("span");
      face.className = "map-marker-face";
      const icon = document.createElement("span");
      icon.textContent = p.status === "pending" ? "···" : "✓";
      icon.setAttribute("aria-hidden", "true");
      face.append(icon);
      button.append(face);
      button.onclick = () => latest.current.onSelect(p.id);
      return new maplibregl.Marker({ element: button, anchor: "bottom" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [props.places, props.selected, props.apiKey]);
  useEffect(() => {
    if (!props.focusRequest) return;
    const { places, selected, onFocusComplete } = latest.current;
    const p = places.find((place) => place.id === selected);
    const map = instance.current;
    if (!p || !map) return;

    // A new selection can interrupt a previous flight. Stop it before
    // registering the arrival handler so an old moveend cannot open a modal.
    map.stop();
    let modalTimer: ReturnType<typeof setTimeout> | undefined;
    const onArrival = () => {
      modalTimer = setTimeout(() => onFocusComplete?.(p.id), 300);
    };
    map.once("moveend", onArrival);
    map.flyTo({
      center: [p.lng, p.lat],
      zoom: Math.max(map.getZoom(), 16),
      duration: 650,
      essential: true,
    });
    return () => {
      map.off("moveend", onArrival);
      if (modalTimer) clearTimeout(modalTimer);
    };
  }, [props.focusRequest]);
  return (
    <div className="relative h-full min-h-[420px]">
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      {error && (
        <p
          role="alert"
          className="absolute bottom-8 left-3 bg-background p-2 text-sm"
        >
          지도를 불러오지 못했습니다. 장소 목록을 이용해 주세요.
        </p>
      )}
    </div>
  );
}
