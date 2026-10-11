"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import type { MapPlace } from "@/domain/types";
import { Badge } from "@/components/ui/badge";
import { placeArea } from "@/domain/place-location";

export function MobilePlaceCarousel({
  places,
  activeId,
  onSelect,
  onOpen,
  onSave,
  isSaved,
  disabled,
  controls,
}: {
  places: MapPlace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  disabled: boolean;
  controls: ReactNode;
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
            <div className="mobile-place-heading flex min-w-0 items-center justify-between gap-3">
              <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
                {place.name}
              </h2>
              <Badge asChild className="mobile-action-badge">
                <button type="button" onClick={() => onOpen(place.id)}>
                  상세 보기
                </button>
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-base leading-6 text-muted-foreground">
              {place.rationale}
            </p>
          </article>
        ))}
      </div>
      <div className="mobile-explorer-actions">
        {controls}
        <Badge
          asChild
          variant={isSaved(currentPlace.id) ? "secondary" : "outline"}
          className="mobile-action-badge"
        >
          <button
            type="button"
            aria-label={`${currentPlace.name} ${isSaved(currentPlace.id) ? "저장 해제" : "저장"}`}
            aria-pressed={isSaved(currentPlace.id)}
            disabled={disabled}
            onClick={() => onSave(currentPlace.id)}
          >
            <Bookmark
              size={12}
              data-icon="inline-start"
              fill={isSaved(currentPlace.id) ? "currentColor" : "none"}
            />
            {isSaved(currentPlace.id) ? "저장됨" : "저장"}
          </button>
        </Badge>
      </div>
    </section>
  );
}
