"use client";
import { MapFailure } from "../map-failure";
import { MapLoading } from "../map-loading";
import { useEffect, useRef, useState } from "react";
import { useMobile } from "@/hooks/use-mobile";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ensureMapLibreWorkerReady } from "./maplibre-worker";
import type { MapProps } from "../types";
import { PLACE_LABEL_MIN_ZOOM, visibleMarkerLabels } from "../marker-labels";
import { appendRecommendation } from "../pin-content";
import {
  configureBasemapLabels,
  NEIGHBORHOOD_SOURCE_ID,
} from "../basemap-labels";

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
  const mobile = useMobile();
  const { places, selected, apiKey } = props;
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<maplibregl.Map | null>(null);
  const latest = useRef(props);
  const pins = useRef(
    new Map<
      string,
      {
        marker: maplibregl.Marker;
        button: HTMLButtonElement;
        icon: HTMLSpanElement;
        face: HTMLSpanElement;
        label: HTMLSpanElement;
        signature: string;
        lat: number;
        lng: number;
      }
    >(),
  );
  const lastReportedBounds = useRef<MapProps["bounds"] | null>(null);
  const [error, setError] = useState(false);
  const [loadedStyle, setLoadedStyle] = useState<string | null>(null);
  const [viewRevision, setViewRevision] = useState(0);
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
        style: apiKey,
        bounds: [
          [b.west, b.south],
          [b.east, b.north],
        ],
        fitBoundsOptions: { padding: 35 },
        attributionControl: false,
        locale: { "AttributionControl.ToggleAttribution": "지도 출처 보기" },
      });
    } catch {
      queueMicrotask(() => setError(true));
      return;
    }
    instance.current = map;
    const currentPins = pins.current;
    let disposeLabels: (() => void) | undefined;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "top-left",
    );
    map.on("load", () => {
      // MapLibre initially expands compact attribution; start with its info button.
      const attribution = map
        .getContainer()
        .querySelector<HTMLDetailsElement>(".maplibregl-ctrl-attrib");
      attribution?.classList.remove("maplibregl-compact-show");
      attribution?.removeAttribute("open");
      disposeLabels = configureBasemapLabels(map);
      setLoadedStyle(apiKey);
    });
    map.on("error", (event) => {
      if (!("sourceId" in event) || event.sourceId !== NEIGHBORHOOD_SOURCE_ID) {
        setError(true);
      }
    });
    map.on("idle", () => setError(false));
    map.on("moveend", () => {
      setViewRevision((revision) => revision + 1);
      const v = map.getBounds();
      const nextBounds = {
        west: Math.max(-180, v.getWest()),
        east: Math.min(180, v.getEast()),
        south: v.getSouth(),
        north: v.getNorth(),
      };
      if (
        lastReportedBounds.current &&
        boundsMatch(lastReportedBounds.current, nextBounds)
      ) {
        return;
      }
      lastReportedBounds.current = nextBounds;
      latest.current.onBoundsChange(nextBounds);
    });
    map.on("click", (event) => {
      latest.current.onMapClick?.({
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      });
    });
    const observer = new ResizeObserver(() => {
      map.resize();
      setViewRevision((revision) => revision + 1);
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      disposeLabels?.();
      currentPins.forEach((pin) => pin.marker.remove());
      currentPins.clear();
      map.remove();
      instance.current = null;
    };
  }, [apiKey]);
  useEffect(() => {
    const map = instance.current;
    if (!map) return;
    const retained = new Set<string>();
    places.forEach((p) => {
      const key = p.id;
      retained.add(key);
      const isSelected = selected === p.id;
      let pin = pins.current.get(key);
      if (!pin) {
        const button = document.createElement("button");
        const face = document.createElement("span");
        face.className = "map-marker-face";
        const icon = document.createElement("span");
        icon.className = "map-marker-recommendation";
        icon.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "map-marker-label";
        label.setAttribute("aria-hidden", "true");
        button.append(face, icon, label);
        button.className = "map-marker";
        const marker = new maplibregl.Marker({
          element: button,
          anchor: "bottom",
        })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        pin = {
          marker,
          button,
          icon,
          face,
          label,
          signature: "",
          lat: p.lat,
          lng: p.lng,
        };
        pins.current.set(key, pin);
      }
      const { button, icon, label } = pin;
      if (label.textContent !== p.name) label.textContent = p.name;
      button.dataset.labelVisible = "false";
      button.type = "button";
      button.title = p.name;
      button.setAttribute(
        "aria-label",
        `${p.name} · 주제 추천 ${p.positive}${p.status === "pending" ? " · 검토 대기" : ""}`,
      );
      button.dataset.selected = String(isSelected);
      button.dataset.status = p.status;
      const signature = `${isSelected}:${p.positive}`;
      if (pin.signature !== signature) {
        icon.replaceChildren();
        if (isSelected) appendRecommendation(icon, p.positive);
        pin.signature = signature;
      }
      if (pin.lat !== p.lat || pin.lng !== p.lng) {
        pin.marker.setLngLat([p.lng, p.lat]);
        pin.lat = p.lat;
        pin.lng = p.lng;
      }
      button.onclick = () => latest.current.onSelect(p.id);
    });
    for (const [key, pin] of pins.current) {
      if (!retained.has(key)) {
        pin.marker.remove();
        pins.current.delete(key);
      }
    }
    // Measure after MapLibre has updated marker transforms. Labels are absolute
    // children, so they never change the marker size or its bottom anchor.
    let frame = 0;
    let disposed = false;
    const layoutLabels = () => {
      const viewport = map.getContainer().getBoundingClientRect();
      const entries = [...pins.current.entries()];
      const pinRects = entries.map(([, pin]) =>
        pin.face.getBoundingClientRect(),
      );
      const candidates = entries.flatMap(([id, pin], index) => {
        const rect = pinRects[index];
        const isSelected = pin.button.dataset.selected === "true";
        if (
          (!isSelected && map.getZoom() < PLACE_LABEL_MIN_ZOOM) ||
          rect.right < viewport.left ||
          rect.left > viewport.right ||
          rect.bottom < viewport.top ||
          rect.top > viewport.bottom
        )
          return [];
        return [
          {
            id,
            selected: isSelected,
            rect: pin.label.getBoundingClientRect(),
            pinRect: rect,
          },
        ];
      });
      const recommendationRects = entries
        .filter(([, pin]) => pin.button.dataset.selected === "true")
        .map(([, pin]) => pin.icon.getBoundingClientRect());
      const visible = visibleMarkerLabels(candidates, [
        ...pinRects,
        ...recommendationRects,
      ]);
      entries.forEach(([id, pin]) => {
        pin.button.dataset.labelVisible = String(visible.has(id));
      });
    };
    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layoutLabels);
    };
    schedule();
    // Re-measure if a web font changes label widths after the first paint.
    void document.fonts.ready.then(schedule);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [places, selected, apiKey, loadedStyle, viewRevision]);
  useEffect(() => {
    if (!props.focusRequest || props.stationFocus) return;
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
    const viewport = map.getContainer().getBoundingClientRect();
    const pinHeight = pins.current.get(p.id)?.button.offsetHeight ?? 0;
    // MapLibre anchors markers at their bottom. Include half the marker height
    // so the circle's visible center sits at 40% of the mobile screen.
    const offsetY = mobile
      ? window.innerHeight * 0.4 -
        viewport.top -
        viewport.height / 2 +
        pinHeight / 2
      : 0;
    map.flyTo({
      center: [p.lng, p.lat],
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      offset: [0, offsetY],
      zoom: Math.max(map.getZoom(), 14),
      duration: 650,
      essential: true,
    });
    return () => {
      map.off("moveend", onArrival);
      if (modalTimer) clearTimeout(modalTimer);
    };
  }, [props.focusRequest, props.stationFocus, mobile]);
  useEffect(() => {
    const map = instance.current;
    const point = props.userLocation;
    if (!map || !point || loadedStyle !== apiKey) return;
    const element = document.createElement("span");
    element.className = "current-location-marker";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "현재 위치");
    const marker = new maplibregl.Marker({ element })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
    map.flyTo({ center: [point.lng, point.lat], zoom: 14, essential: true });
    return () => {
      marker.remove();
    };
  }, [props.userLocation, loadedStyle, apiKey]);
  useEffect(() => {
    const map = instance.current;
    const focus = props.stationFocus;
    if (!map || !focus || loadedStyle !== apiKey) return;
    const element = document.createElement("span");
    element.className = "selected-station-marker";
    element.textContent = `🚉 ${focus.station.name}`;
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", `선택 역 ${focus.station.name}`);
    const marker = new maplibregl.Marker({ element })
      .setLngLat([focus.station.lng, focus.station.lat])
      .addTo(map);
    const bounds = new maplibregl.LngLatBounds(
      [focus.place.lng, focus.place.lat],
      [focus.place.lng, focus.place.lat],
    );
    bounds.extend([focus.station.lng, focus.station.lat]);
    map.fitBounds(bounds, {
      padding: { top: 100, left: 70, right: 70, bottom: 280 },
      maxZoom: 16,
    });
    return () => {
      marker.remove();
    };
  }, [props.stationFocus, loadedStyle, apiKey]);
  return (
    <div className="maplibre-map relative h-full min-h-[420px]">
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      {loadedStyle !== apiKey && !error && (
        <div className="absolute inset-0 z-10">
          <MapLoading />
        </div>
      )}
      {error && (
        <div className="absolute bottom-3 left-3 right-3 z-20">
          <MapFailure onFallback={props.onFallback} />
        </div>
      )}
    </div>
  );
}
