"use client";
import { useEffect, useRef } from "react";
import { Bookmark, List } from "lucide-react";
import type { MapPlace } from "@/domain/types";
import { placeArea } from "@/domain/place-location";

export function MobilePlaceCarousel({
  places,
  activeId,
  onSelect,
  onOpen,
  onSave,
  isSaved,
  disabled,
  onList,
}: {
  places: MapPlace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  disabled: boolean;
  onList: () => void;
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
    if (element)
      element.scrollTo({
        left: index * element.clientWidth,
        behavior: "instant",
      });
  }, [index, places]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (!places.length) return null;
  return (
    <section className="mobile-place-carousel" aria-label="장소 미리보기">
      <div className="mobile-place-meta flex items-center justify-between px-4">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {placeArea(currentPlace.address) || "기타 지역"} · {index + 1} /{" "}
          {places.length}곳
        </span>
        <button
          onClick={onList}
          aria-label="목록 보기"
          className="mobile-place-list-button"
        >
          <List size={19} aria-hidden="true" />
        </button>
      </div>
      <div
        ref={track}
        className="mobile-place-track"
        onScroll={() => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const element = track.current;
            if (!element) return;
            const next = Math.round(element.scrollLeft / element.clientWidth);
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
