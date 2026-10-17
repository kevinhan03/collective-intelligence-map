"use client";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ThumbsUp,
  X,
} from "lucide-react";
import { usePlaceComments } from "./use-place-comments";
import type { MapPlace } from "@/domain/types";
import { PlaceSheetHandle } from "./place-sheet-handle";
import { PlacePhotos } from "./place-photos";
import { PlaceBackdrop } from "./place-backdrop";
import { usePlaceSwipe } from "@/hooks/use-place-swipe";
import { usePlaceSheetDrag } from "@/hooks/use-place-sheet-drag";
import { useSheetStageMotion } from "@/hooks/use-sheet-stage-motion";
import { placeArea } from "@/domain/place-location";

export function MobilePlaceCarousel({
  places,
  activeId,
  onSelect,
  onOpen,
  onSave,
  isSaved,
  disabled,
  votePending = false,
  savePending = false,
  controls,
  demo,
  creator = false,
  onClose,
  onOpenComments,
  onVote,
  getVote,
}: {
  places: MapPlace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  disabled: boolean;
  votePending?: boolean;
  savePending?: boolean;
  controls: ReactNode;
  demo: boolean;
  creator?: boolean;
  onClose: () => void;
  onOpenComments: (id: string) => void;
  onVote: (id: string) => void;
  getVote: (id: string) => number;
}) {
  const card = useRef<HTMLElement>(null);
  useSheetStageMotion(card, "summary");
  const track = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aligning = useRef(false);
  const index = Math.max(
    0,
    places.findIndex((p) => p.id === activeId),
  );
  const currentPlace = places[index];
  const thread = usePlaceComments(
    currentPlace?.id ?? "",
    demo || !currentPlace,
  );
  const expand = () => {
    if (currentPlace) onOpen(currentPlace.id);
  };
  const collapse = onClose;
  const selectAdjacent = (direction: number) => {
    const next = index + direction;
    if (places[next]) onSelect(places[next].id);
  };
  const drag = usePlaceSheetDrag(expand, collapse);
  const swipe = usePlaceSwipe(index, places.length, selectAdjacent);
  const previousIndex = useRef(index);
  useLayoutEffect(() => {
    if (
      previousIndex.current !== index &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const direction = index > previousIndex.current ? 1 : -1;
      card.current
        ?.querySelectorAll<HTMLElement>(
          ".place-sheet-title-row, .mobile-place-meta, .mobile-place-summary",
        )
        .forEach((element) => {
          element.animate(
            [
              { transform: `translateX(${direction * 24}px)`, opacity: 0.5 },
              { transform: "translateX(0)", opacity: 1 },
            ],
            { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
        });
    }
    previousIndex.current = index;
  }, [index]);
  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const slide = element.children[index] as HTMLElement | undefined;
    const summary = slide?.querySelector<HTMLElement>(".mobile-place-summary");
    if (!slide || !summary) return;
    // The horizontal track must follow the selected slide's intrinsic content,
    // rather than inheriting the tallest off-screen introduction's height.
    const fitHeight = () => {
      const contentStyle = getComputedStyle(summary);
      const slideStyle = getComputedStyle(slide);
      const height = Math.ceil(
        summary.getBoundingClientRect().height +
          parseFloat(contentStyle.marginTop) +
          parseFloat(contentStyle.marginBottom) +
          parseFloat(slideStyle.paddingTop) +
          parseFloat(slideStyle.paddingBottom),
      );
      const value = `${height}px`;
      if (element.style.height !== value) element.style.height = value;
    };
    let alignmentFrame = 0;
    const align = () => {
      const first = element.children[0] as HTMLElement;
      const slide = element.children[index] as HTMLElement;
      if (!first || !slide) return;
      if (timer.current) clearTimeout(timer.current);
      cancelAnimationFrame(alignmentFrame);
      aligning.current = true;
      const left = slide.offsetLeft - first.offsetLeft;
      element.scrollTo({
        left,
        behavior: "instant",
      });
      alignmentFrame = requestAnimationFrame(() => {
        element.scrollTo({ left, behavior: "instant" });
        aligning.current = false;
      });
    };
    fitHeight();
    align();
    Array.from(element.children).forEach((slide) => {
      (slide as HTMLElement).scrollTop = 0;
    });
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      fitHeight();
      if (width === element.clientWidth) return;
      width = element.clientWidth;
      align();
    });
    observer.observe(element);
    observer.observe(summary);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(alignmentFrame);
      if (timer.current) clearTimeout(timer.current);
      aligning.current = false;
    };
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
      ref={card}
      {...swipe}
      className="mobile-place-carousel"
      data-multiple={places.length > 1}
      data-sheet-stage="summary"
      aria-label="장소 미리보기"
    >
      <PlaceBackdrop
        key={currentPlace.place_id}
        placeId={currentPlace.place_id}
        demo={demo}
      />
      <div className="place-sheet-drag-zone" {...drag}>
        <PlaceSheetHandle
          stage="summary"
          onExpand={expand}
          onCollapse={collapse}
        />
        <div className="place-sheet-title-row">
          <h2 className="place-sheet-title">{currentPlace.name}</h2>
          <div className="place-sheet-heading-actions">
            <button
              type="button"
              className="mobile-save-action"
              aria-label={`${currentPlace.name} ${isSaved(currentPlace.id) ? "저장 해제" : "저장"}`}
              aria-pressed={isSaved(currentPlace.id)}
              disabled={disabled || savePending}
              onClick={() => onSave(currentPlace.id)}
            >
              <Bookmark
                size={19}
                fill={isSaved(currentPlace.id) ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
            <button
              className="place-sheet-close"
              aria-label="장소 카드 닫기"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>
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
          if (aligning.current) return;
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
            {Math.abs(i - index) <= 1 && (
              <div className="mobile-place-summary space-y-3">
                {place.rationale && (
                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {place.rationale}
                  </p>
                )}
                <div className="place-summary-participation">
                  {!creator && (
                    <button
                      type="button"
                      className="detail-reaction"
                      disabled={disabled || votePending}
                      aria-pressed={getVote(place.id) === 1}
                      aria-label={`주제에 어울려요 ${place.positive}`}
                      onClick={() => onVote(place.id)}
                    >
                      <ThumbsUp size={18} />
                      <span>주제에 어울려요 {place.positive}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="detail-reaction"
                    aria-label={`댓글 ${i === index ? thread.total : 0}개 모두 보기`}
                    onClick={() => onOpenComments(place.id)}
                  >
                    <MessageCircle size={18} />
                    <span>{i === index ? thread.total : ""}</span>
                  </button>
                </div>
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
      <div className="mobile-explorer-actions">{controls}</div>
    </section>
  );
}
