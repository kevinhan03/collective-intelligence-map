"use client";
import { useEffect, useRef } from "react";
import { Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { NearbyStationInfo } from "./nearby-stations";
import {
  distanceMeters,
  formatDistance,
  type Coordinate,
} from "@/domain/visit";
import type { MapPlace, RailStation } from "@/domain/types";
import { placeArea } from "@/domain/place-location";

export function MobilePlaceCarousel({
  places,
  activeId,
  onSelect,
  onOpen,
  onSave,
  isSaved,
  disabled,
  demo,
  userLocation,
  onStationSelect,
}: {
  places: MapPlace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  disabled: boolean;
  demo: boolean;
  userLocation: Coordinate | null;
  onStationSelect: (station: RailStation, place: MapPlace) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(
    0,
    places.findIndex((p) => p.id === activeId),
  );
  const currentPlace = places[index];
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const align = () => {
      const first = element.children[0] as HTMLElement;
      const slide = element.children[index] as HTMLElement;
      if (!first || !slide) return;
      element.scrollTo({
        left: slide.offsetLeft - first.offsetLeft,
        behavior: "instant",
      });
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, places]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (!places.length) return null;
  return (
    <section
      className="mobile-place-carousel"
      data-multiple={places.length > 1}
      aria-label="장소 미리보기"
    >
      <div className="mobile-place-meta flex items-center justify-between px-4">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {placeArea(currentPlace.address) || "기타 지역"} · {index + 1} /{" "}
          {places.length}곳
        </span>
        <div className="mobile-place-controls">
          <button
            aria-label="이전 장소"
            className="mobile-place-arrow"
            disabled={index === 0}
            onClick={() => onSelect(places[index - 1].id)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            aria-label="다음 장소"
            className="mobile-place-arrow"
            disabled={index === places.length - 1}
            onClick={() => onSelect(places[index + 1].id)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={track}
        className="mobile-place-track"
        onScroll={() => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const element = track.current;
            if (!element) return;
            const first = element.children[0] as HTMLElement;
            if (!first) return;
            const next = Array.from(element.children).reduce(
              (best, child, i, slides) => {
                const distance = Math.abs(
                  (child as HTMLElement).offsetLeft -
                    first.offsetLeft -
                    element.scrollLeft,
                );
                const bestDistance = Math.abs(
                  (slides[best] as HTMLElement).offsetLeft -
                    first.offsetLeft -
                    element.scrollLeft,
                );
                return distance < bestDistance ? i : best;
              },
              0,
            );
            if (places[next] && places[next].id !== activeId)
              onSelect(places[next].id);
          }, 120);
        }}
      >
        {places.map((place, i) => (
          <article
            key={place.id}
            className="mobile-place-slide"
            aria-label={`${place.name} 미리보기`}
            inert={i !== index}
            aria-hidden={i !== index}
          >
            <h2 className="truncate text-lg font-semibold">{place.name}</h2>
            {userLocation && (
              <p className="text-xs text-muted-foreground">
                직선거리 {formatDistance(distanceMeters(userLocation, place))}
              </p>
            )}
            {i === index && (
              <NearbyStationInfo
                key={place.place_id}
                place={place}
                compact
                demo={demo}
                onSelect={(station) => onStationSelect(station, place)}
              />
            )}
            <p className="mt-1 line-clamp-2 text-base leading-6 text-muted-foreground">
              {place.rationale}
            </p>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
                onClick={() => onOpen(place.id)}
              >
                상세 보기
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-xl border px-3"
                aria-label={`${place.name} ${isSaved(place.id) ? "저장 해제" : "저장"}`}
                aria-pressed={isSaved(place.id)}
                disabled={disabled}
                onClick={() => onSave(place.id)}
              >
                <Bookmark
                  size={18}
                  fill={isSaved(place.id) ? "currentColor" : "none"}
                />
                {isSaved(place.id) ? "저장됨" : "저장"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
