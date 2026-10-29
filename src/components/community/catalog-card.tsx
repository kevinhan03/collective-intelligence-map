"use client";
import Link from "next/link";
import { Bookmark, Flame } from "lucide-react";
import type { CatalogMap } from "@/domain/map-catalog";
import { catalogLocation } from "@/domain/map-catalog";
import { MapCardBackdrop } from "./map-card-backdrop";
import type { useMapEngagement } from "./use-map-engagement";
import styles from "./map-catalog.module.css";
type Engagement = ReturnType<typeof useMapEngagement>;
function Reaction({
  map,
  engagement,
  action,
}: {
  map: CatalogMap;
  engagement: Engagement;
  action: "hype" | "save_map";
}) {
  const active =
    action === "hype" ? engagement.isHyped(map.id) : engagement.isSaved(map.id);
  const pending = engagement.isPending(action, map.id);
  const label =
    action === "hype"
      ? `Hype ${active ? "취소" : "추천"}`
      : `지도 저장${active ? " 취소" : ""}`;
  return (
    <button
      type="button"
      className={action === "hype" ? styles.hype : styles.bookmark}
      aria-label={`${map.displayTitle} ${label}`}
      title={action === "hype" ? "이 지도 추천하기 · 숫자는 누적 Hype" : label}
      aria-pressed={active}
      aria-busy={pending}
      disabled={!engagement.interactive || !engagement.ready || pending}
      onClick={() => void engagement.toggle(action, map.id)}
    >
      <span className={styles.reactionSurface}>
        {action === "hype" ? (
          <>
            <Flame size={14} aria-hidden="true" />
            <span>{(map.hype_count ?? 0).toLocaleString("ko-KR")}</span>
          </>
        ) : (
          <Bookmark
            size={15}
            aria-hidden="true"
            fill={active ? "currentColor" : "none"}
          />
        )}
      </span>
    </button>
  );
}
export function CatalogCard({
  map,
  engagement,
  featured = false,
  region = "",
  onNavigate,
}: {
  map: CatalogMap;
  engagement: Engagement;
  featured?: boolean;
  region?: string;
  onNavigate?: () => void;
}) {
  const location = catalogLocation(map, region);
  const inclusive = Boolean(region && map.regions[0] !== region);
  const count = `${inclusive ? "전체 " : ""}${map.place_count.toLocaleString("ko-KR")}곳`;
  return (
    <article
      className={`${styles.card} ${featured ? styles.featured : ""}`}
      data-catalog-card
      data-slug={map.slug}
    >
      <Link
        href={`/maps/${map.slug}`}
        prefetch={false}
        onClick={onNavigate}
        className={styles.cardLink}
        aria-label={`${map.displayTitle} 지도 열기`}
      >
        <div className={styles.photo}>
          <MapCardBackdrop slug={map.slug} sharp eager={featured} />
        </div>
        <div className={styles.cardInfo}>
          <h3>{map.displayTitle}</h3>
          {featured && <p className={styles.reason}>{map.featureReason}</p>}
          <p className={styles.meta}>
            {location}
            {!featured && map.categoryLabel ? ` · ${map.categoryLabel}` : ""}
          </p>
          {featured && <span className={styles.featureCount}>{count}</span>}
        </div>
      </Link>
      <Reaction map={map} engagement={engagement} action="save_map" />
      <div className={styles.cardFooter}>
        <Reaction map={map} engagement={engagement} action="hype" />
        {!featured && <span className={styles.count}>{count}</span>}
      </div>
    </article>
  );
}
