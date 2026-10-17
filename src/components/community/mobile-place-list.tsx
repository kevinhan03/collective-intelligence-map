"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bookmark } from "lucide-react";
import type { MapPlace } from "@/domain/types";
import { placeArea } from "@/domain/place-location";
import { isNew, isControversial, isVerified } from "@/domain/relevance";
import { photoImageUrl } from "@/domain/place-photo";
import { createThumbnailQueue } from "./place-thumbnail-queue";

type Props = {
  places: MapPlace[];
  selected: string | null;
  active: boolean;
  demo: boolean;
  busy: boolean;
  isSavePending?: (id: string) => boolean;
  isSaved: (id: string) => boolean;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  station?: { name: string; distance: (place: MapPlace) => string | null };
};
export function MobilePlaceList(props: Props) {
  const [queue, setQueue] = useState<ReturnType<
    typeof createThumbnailQueue
  > | null>(null);
  useEffect(() => {
    const current = createThumbnailQueue();
    // Observer callbacks run after this list-scoped queue is attached.
    const frame = requestAnimationFrame(() => setQueue(current));
    return () => {
      cancelAnimationFrame(frame);
      current.dispose();
    };
  }, []);
  return props.places.map((place, index) => (
    <MobilePlaceRow
      key={`${place.id}:${place.place_id}`}
      {...props}
      place={place}
      index={index}
      queue={queue}
    />
  ));
}
function MobilePlaceRow({
  place,
  index,
  queue,
  ...props
}: Props & {
  place: MapPlace;
  index: number;
  queue: ReturnType<typeof createThumbnailQueue> | null;
}) {
  const row = useRef<HTMLElement>(null);
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (
      !props.active ||
      props.demo ||
      !queue ||
      !row.current ||
      photo !== undefined
    )
      return;
    let cancel: (() => void) | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        cancel = queue.load(place.place_id, setPhoto);
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(row.current);
    return () => {
      observer.disconnect();
      cancel?.();
    };
  }, [props.active, props.demo, queue, place.place_id, photo]);
  const saved = props.isSaved(place.id);
  const distance = props.station?.distance(place);
  return (
    <article
      ref={row}
      className="mobile-list-place"
      data-selected={props.selected === place.id}
      onClick={() => props.onOpen(place.id)}
    >
      <span className="mobile-list-order" aria-hidden="true">
        {index + 1}
      </span>
      <div className="mobile-list-layout">
        {photo && (
          <Image
            className="mobile-list-thumbnail"
            src={photoImageUrl(photo, true)}
            width={76}
            height={76}
            unoptimized
            alt=""
            onError={() => setPhoto(null)}
          />
        )}
        <div className="mobile-list-content">
          <div className="mobile-list-title-row">
            <button
              type="button"
              className="mobile-list-title"
              onClick={(event) => {
                event.stopPropagation();
                props.onOpen(place.id);
              }}
            >
              <span className="mobile-list-title-text">{place.name}</span>
            </button>
            <button
              type="button"
              className="mobile-list-save"
              aria-label={`${place.name} ${saved ? "저장 해제" : "저장"}`}
              aria-pressed={saved}
              disabled={
                props.demo || props.busy || props.isSavePending?.(place.id)
              }
              onClick={(event) => {
                event.stopPropagation();
                props.onSave(place.id);
              }}
            >
              <Bookmark
                size={18}
                fill={saved ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          </div>
          {!props.demo &&
            (isNew(place) || isControversial(place) || isVerified(place)) && (
              <div className="mobile-list-badges">
                {isNew(place) && (
                  <span className="place-badge place-badge-new">NEW</span>
                )}
                {isControversial(place) && (
                  <span className="place-badge place-badge-controversial">
                    논쟁 중
                  </span>
                )}
                {isVerified(place) && (
                  <span className="place-badge place-badge-verified">
                    검증됨
                  </span>
                )}
              </div>
            )}
          <div className="mobile-list-body">
            <div className="mobile-list-copy">
              {(props.demo || placeArea(place.address)) && (
                <p className="mobile-list-area">
                  {[props.demo ? "가상 예시" : null, placeArea(place.address)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {place.rationale && (
                <p className="mobile-list-reason">{place.rationale}</p>
              )}
              {distance && (
                <p className="mobile-list-area">
                  {props.station?.name} · 직선거리 {distance}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
