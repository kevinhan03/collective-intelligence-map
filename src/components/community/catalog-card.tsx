"use client";
import Link from "@/i18n/link";
import { Bookmark, Flame } from "lucide-react";
import type { CatalogMap } from "@/domain/map-catalog";
import { MapCardBackdrop } from "./map-card-backdrop";
import type { useMapEngagement } from "./use-map-engagement";
import styles from "./map-catalog.module.css";
import { useI18n } from "@/i18n/client";
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
  const { t } = useI18n();
  const active =
    action === "hype" ? engagement.isHyped(map.id) : engagement.isSaved(map.id);
  const pending = engagement.isPending(action, map.id);
  const label = t(
    action === "hype"
      ? active
        ? "home.unhypeMapLabel"
        : "home.hypeMapLabel"
      : active
        ? "home.unsaveMapLabel"
        : "home.saveMapLabel",
    { title: map.displayTitle },
  );
  return (
    <button
      type="button"
      className={action === "hype" ? styles.hype : styles.bookmark}
      aria-label={label}
      title={action === "hype" ? t("home.hypeThisMapTheNumber") : label}
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
  onSelect,
  selected,
}: {
  map: CatalogMap;
  engagement: Engagement;
  featured?: boolean;
  region?: string;
  onNavigate?: () => void;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const { t } = useI18n();
  const inclusive = Boolean(region && map.regions[0] !== region);
  const location = inclusive
    ? `${t.data("region", map.regionLabel)} ${t("home.includes", { region: t.data("region", region) })}`
    : t.data("region", map.regionLabel);
  const count = t(
    inclusive ? "home.placeCountAllPlain" : "home.placeCountPlain",
    {
      count: map.place_count,
    },
  );
  return (
    <article
      className={`${styles.card} ${featured ? styles.featured : ""}`}
      data-catalog-card
      data-editor-selected={selected || undefined}
      data-slug={map.slug}
    >
      <Link
        href={`/maps/${map.slug}`}
        prefetch={false}
        onClick={(event) => {
          if (onSelect) {
            event.preventDefault();
            onSelect();
          } else onNavigate?.();
        }}
        className={styles.cardLink}
        aria-label={t(onSelect ? "home.editMapLabel" : "home.openMapLabel", {
          title: map.displayTitle,
        })}
      >
        <div className={styles.photo}>
          <MapCardBackdrop
            slug={map.slug}
            editorial={map.editorial}
            sharp
            eager={featured}
          />
        </div>
        <div className={styles.cardInfo}>
          <h3>{map.displayTitle}</h3>
          {featured && <p className={styles.reason}>{map.featureReason}</p>}
          <p className={styles.meta}>
            {location}
            {!featured && map.categoryLabel
              ? ` · ${t.data("categoryLabel", map.categoryLabel)}`
              : ""}
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
