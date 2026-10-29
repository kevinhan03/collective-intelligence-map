"use client";
import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bookmark, ChevronUp, Flame } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { mapTheme } from "@/domain/map-order";
import { formatLocation } from "@/domain/location";
import { MapCardBackdrop } from "./map-card-backdrop";
import type { useMapEngagement } from "./use-map-engagement";
import styles from "./mobile-discovery.module.css";

export function MobileMapStory({
  map,
  expanded,
  onExpand,
  onClose,
  engagement,
}: {
  map: ThemeMap;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  engagement: ReturnType<typeof useMapEngagement>;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const href = `/maps/${map.slug}`;
  function close() {
    onClose();
    trigger.current?.focus({ preventScroll: true });
  }
  return (
    <article
      className={styles.story}
      data-expanded={expanded}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        className={styles.storyCover}
        aria-expanded={expanded}
        aria-controls={`map-preview-${map.id}`}
        aria-label={`${map.title} ${expanded ? "전체 지도 열기" : "미리보기"}`}
        onClick={() => {
          if (expanded) router.push(href);
          else {
            onExpand();
            router.prefetch(href);
          }
        }}
      >
        <MapCardBackdrop slug={map.slug} />
        <span className={styles.coverShade} aria-hidden="true" />
        <h2 aria-label={map.title}>
          {map.title}
          <small className="mt-2 block text-xs font-normal">
            {formatLocation(map)} · {mapTheme(map)}
          </small>
        </h2>
        <span
          className={styles.placeCount}
          role="img"
          aria-label={`장소 ${map.place_count.toLocaleString("ko-KR")}개`}
        >
          {map.place_count ? (
            <>
              {map.place_count.toLocaleString("ko-KR")}
              <span className={styles.countUnit}>곳</span>
            </>
          ) : (
            <small className="text-xs">첫 장소 모집 중</small>
          )}
        </span>
      </button>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.hypeAction}
          aria-label={`${map.title} Hype ${engagement.isHyped(map.id) ? "취소" : "추천"}`}
          aria-pressed={engagement.isHyped(map.id)}
          aria-busy={engagement.isPending("hype", map.id)}
          disabled={
            !engagement.interactive ||
            !engagement.ready ||
            engagement.isPending("hype", map.id)
          }
          onClick={() => void engagement.toggle("hype", map.id)}
        >
          <span className={styles.hypeVisual}>
            <Flame size={14} aria-hidden="true" />
            <span>{(map.hype_count ?? 0).toLocaleString("ko-KR")}</span>
          </span>
        </button>
        <button
          type="button"
          className={styles.saveAction}
          aria-label={`${map.title} 지도 ${engagement.isSaved(map.id) ? "저장 취소" : "저장"}`}
          aria-pressed={engagement.isSaved(map.id)}
          aria-busy={engagement.isPending("save_map", map.id)}
          disabled={
            !engagement.interactive ||
            !engagement.ready ||
            engagement.isPending("save_map", map.id)
          }
          onClick={() => void engagement.toggle("save_map", map.id)}
        >
          <span className={styles.saveVisual}>
            <Bookmark
              size={14}
              fill={engagement.isSaved(map.id) ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </span>
        </button>
      </div>
      <div
        id={`map-preview-${map.id}`}
        className={styles.previewExpansion}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div className={styles.previewClip}>
          <div
            className={styles.previewContent}
            role="region"
            aria-label={`${map.title} 미리보기 정보`}
          >
            <div className={styles.previewMeta}>
              <span>
                {formatLocation(map)}{" "}
                <span className={styles.metaDivider}>|</span> 장소{" "}
                {map.place_count}곳
              </span>
              <Link
                href={href}
                prefetch={false}
                aria-label={`${map.title} 전체 지도 열기`}
              >
                <ArrowUpRight size={27} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.previewDescription}>
              <p>{map.description}</p>
              {!map.place_count && (
                <Link
                  href={`${href}/submit`}
                  className="inline-block py-3 text-sm text-primary underline"
                >
                  첫 장소 제안하기
                </Link>
              )}
              <p className={styles.followers}>
                저장{" "}
                {(map.saved_count ?? map.follower_count).toLocaleString(
                  "ko-KR",
                )}
                명
              </p>
            </div>
            <button
              type="button"
              className={styles.closePreview}
              aria-label={`${map.title} 미리보기 닫기`}
              onClick={close}
            >
              <span>
                접기 <ChevronUp size={15} aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
