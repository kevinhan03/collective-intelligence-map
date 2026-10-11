"use client";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Bookmark, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MapPlace } from "@/domain/types";
import { PlaceSheetHandle } from "./place-sheet-handle";
import { PlacePhotos } from "./place-photos";
import { Badge } from "@/components/ui/badge";
import { usePlaceSheetDrag } from "@/hooks/use-place-sheet-drag";
import { animateSheetFrom, sheetOrigin } from "./place-sheet-motion";
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
  demo,
  stage,
  onStageChange,
  onClose,
  showHint,
}: {
  places: MapPlace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  disabled: boolean;
  controls: ReactNode;
  demo: boolean;
  stage: "collapsed" | "summary";
  onStageChange: (stage: "collapsed" | "summary") => void;
  onClose: () => void;
  showHint: boolean;
}) {
  const card = useRef<HTMLElement>(null);
  const previousGeometry = useRef<{ top: number; height: number } | null>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (
        element.hasAttribute("data-dragging") ||
        element
          .getAnimations()
          .some((animation) => animation.playState === "running")
      )
        return;
      const rect = element.getBoundingClientRect();
      previousGeometry.current = { top: rect.top, height: rect.height };
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    const current = sheetOrigin(element);
    if (previousGeometry.current && previousStage.current !== stage) {
      animateSheetFrom(element, {
        ...previousGeometry.current,
        top:
          current.top !== element.getBoundingClientRect().top
            ? current.top
            : previousGeometry.current.top,
      });
    }
    previousGeometry.current = {
      top: element.getBoundingClientRect().top,
      height: current.height,
    };
    previousStage.current = stage;
  }, [stage]);
  const track = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(
    0,
    places.findIndex((p) => p.id === activeId),
  );
  const currentPlace = places[index];
  const expand = () => {
    if (stage === "collapsed") onStageChange("summary");
    else if (currentPlace) onOpen(currentPlace.id);
  };
  const collapse = () => onStageChange("collapsed");
  const drag = usePlaceSheetDrag(expand, collapse, (direction) => {
    const next = index + direction;
    if (places[next]) onSelect(places[next].id);
  });
  useLayoutEffect(() => {
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
    Array.from(element.children).forEach((slide) => {
      (slide as HTMLElement).scrollTop = 0;
    });
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === element.clientWidth) return;
      width = element.clientWidth;
      align();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, places, stage]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (!places.length) return null;
  return (
    <section
      ref={card}
      className="mobile-place-carousel"
      data-multiple={places.length > 1}
      data-sheet-stage={stage}
      aria-label="장소 미리보기"
    >
      <div className="place-sheet-drag-zone" {...drag}>
        <PlaceSheetHandle
          stage={stage}
          onExpand={expand}
          onCollapse={collapse}
        />
        <div className="place-sheet-title-row">
          <h2 className="place-sheet-title">{currentPlace.name}</h2>
          <button
            className="place-sheet-close"
            aria-label="장소 카드 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {showHint && (
          <p className="place-sheet-intro">위로 올려 장소 정보 보기</p>
        )}
      </div>
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
            {stage === "summary" && (
              <div className="mobile-place-summary space-y-3">
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {place.rationale}
                </p>
                <p className="text-xs text-muted-foreground">
                  주제 추천 {place.positive} · 다른 의견 {place.negative}
                </p>
                {i === index && (
                  <PlacePhotos
                    key={place.place_id}
                    placeId={place.place_id}
                    viewer={null}
                    loginHref=""
                    demo={demo}
                    preview
                    onOpenDetail={() => onOpen(place.id)}
                  />
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="mobile-explorer-actions">
        {controls}
        <Badge
          asChild
          variant={isSaved(currentPlace.id) ? "secondary" : "outline"}
          className="mobile-save-action"
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
            <span className="sr-only">
              {isSaved(currentPlace.id) ? "저장됨" : "저장"}
            </span>
          </button>
        </Badge>
      </div>
    </section>
  );
}
