"use client";
import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";
import { MapCardBackdrop } from "./map-card-backdrop";
import styles from "./mobile-discovery.module.css";

export function MobileMapStory({
  map,
  expanded,
  onExpand,
  onClose,
}: {
  map: ThemeMap;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
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
        onClick={() => (expanded ? router.push(href) : onExpand())}
      >
        <MapCardBackdrop slug={map.slug} />
        <span className={styles.coverShade} aria-hidden="true" />
        <h2>{map.title}</h2>
      </button>
      {expanded && (
        <button
          className={styles.closePreview}
          aria-label={`${map.title} 미리보기 닫기`}
          onClick={close}
        >
          <X size={27} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
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
              <Link href={href} aria-label={`${map.title} 전체 지도 열기`}>
                <ArrowUpRight size={27} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.previewDescription}>
              <p>{map.description}</p>
              <p className={styles.followers}>
                팔로워 {map.follower_count.toLocaleString("ko-KR")}명
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
