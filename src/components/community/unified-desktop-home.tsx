"use client";

import Link from "@/i18n/link";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  Flame,
  Search,
  X,
} from "lucide-react";
import { catalogCategories } from "@/domain/catalog-config";
import {
  filterCatalog,
  parseUnifiedCatalogFilters,
  unifiedCatalogHref,
  type CatalogFilters,
  type CatalogMap,
} from "@/domain/map-catalog";
import { MapCardBackdrop } from "./map-card-backdrop";
import { useMapEngagement } from "./use-map-engagement";
import styles from "./unified-desktop-home.module.css";

import { useI18n } from "@/i18n/client";
import { rich } from "@/i18n/rich";
type SavedPosition = { limit: number; scroll: number };
const sorts = ["popular", "saved", "newest"] as const;

export function UnifiedDesktopHome({
  maps,
  demo = false,
  editor,
}: {
  maps: CatalogMap[];
  demo?: boolean;
  editor?: {
    selectedId: string;
    changedIds: string[];
    filters: CatalogFilters;
    onFiltersChange: (filters: CatalogFilters) => void;
    onSelect: (id: string) => void;
  };
}) {
  const { t } = useI18n();
  const editorMode = Boolean(editor);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const parsedFilters = parseUnifiedCatalogFilters(
    new URLSearchParams(params.toString()),
    maps,
  );
  const filters = editor?.filters ?? parsedFilters;
  const href = unifiedCatalogHref(filters, pathname);
  const storageKey = `ting:unified-catalog:${href}`;
  const engagement = useMapEngagement(maps, demo, "desktop");
  const results = filterCatalog(maps.map(engagement.withCounts), filters);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const limit = limits[href] ?? 24;
  const limitRef = useRef(limit);
  const skipRestore = useRef(false);
  const search = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const regions = [...new Set(maps.flatMap((map) => map.regions))].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);
  useEffect(() => {
    if (editorMode) return;
    let active = true;
    let frame = 0;
    let scrollFrame = 0;
    try {
      const saved: SavedPosition | null = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      );
      if (
        saved &&
        Number.isFinite(saved.limit) &&
        Number.isFinite(saved.scroll) &&
        !skipRestore.current
      ) {
        queueMicrotask(() => {
          if (!active) return;
          setLimits((value) => ({
            ...value,
            [href]: Math.max(24, Math.min(maps.length, saved.limit)),
          }));
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              if (active)
                window.scrollTo({
                  top: Math.max(0, saved.scroll),
                  behavior: "instant",
                });
            });
          });
        });
      }
    } catch {
      /* Session storage is optional. */
    }
    skipRestore.current = false;
    const save = () => {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ limit: limitRef.current, scroll: window.scrollY }),
        );
      } catch {
        /* optional */
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
    };
  }, [href, storageKey, maps.length, editorMode]);

  function remember() {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ limit, scroll: window.scrollY }),
      );
    } catch {
      /* optional */
    }
  }
  function update(patch: Partial<CatalogFilters>) {
    if (editor) {
      editor.onFiltersChange({ ...filters, ...patch });
      return;
    }
    remember();
    skipRestore.current = true;
    router.push(unifiedCatalogHref({ ...filters, ...patch }, pathname), {
      scroll: false,
    });
  }
  const conditions = (["q", "category", "region"] as const).filter((key) =>
    Boolean(filters[key]),
  );
  const conditionName = (key: (typeof conditions)[number]) =>
    key === "category"
      ? t.data("category", filters.category)
      : t.data("region", filters[key]);

  return (
    <div
      className={styles.catalog}
      data-unified-desktop-home
      data-editor-mode={editorMode || undefined}
      data-map-catalog="unified"
    >
      <section className={styles.intro} aria-label={t("home.findMapsByTaste")}>
        <h1>
          {rich(t("home.headline"), { hl: (chunk) => <span>{chunk}</span> })}
        </h1>
        <p>{t("home.discoverYourNextPlaceThrough")}</p>
        <form
          key={filters.q}
          className={styles.search}
          role="search"
          aria-label={t("home.findThemeMaps")}
          onSubmit={(event) => {
            event.preventDefault();
            const q = String(
              new FormData(event.currentTarget).get("q") ?? "",
            ).trim();
            update({ q });
            heading.current?.focus({ preventScroll: true });
          }}
        >
          <Search size={20} aria-hidden="true" />
          <input
            ref={search}
            type="search"
            name="q"
            maxLength={100}
            aria-label={t("home.searchMaps")}
            defaultValue={filters.q}
            placeholder={t("home.searchByAreaOrTheme")}
          />
          {filters.q && (
            <button
              type="button"
              className={styles.clear}
              aria-label={t("home.clearSearch")}
              onClick={() => {
                update({ q: "" });
                search.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            className={styles.submit}
            aria-label={t("home.showMapResults")}
          >
            <ArrowRight size={22} />
          </button>
        </form>
        <nav className={styles.categories} aria-label={t("home.mapCategories")}>
          {[{ id: "", label: t("home.all") }, ...catalogCategories].map((c) => (
            <Link
              key={c.id}
              href={unifiedCatalogHref(
                { ...filters, category: c.id },
                pathname,
              )}
              scroll={false}
              prefetch={false}
              data-category={c.id || "all"}
              aria-current={filters.category === c.id ? "page" : undefined}
              onClick={(event) => {
                if (editor) {
                  event.preventDefault();
                  update({ category: c.id });
                  return;
                }
                remember();
                skipRestore.current = true;
              }}
            >
              {c.id ? t.data("category", c.id) : c.label}
            </Link>
          ))}
        </nav>
      </section>
      <section aria-labelledby="unified-map-results">
        <h2
          id="unified-map-results"
          tabIndex={-1}
          ref={heading}
          className={styles.srOnly}
        >
          {t("home.mapSearchResults")}
        </h2>
        <div className={styles.toolbar}>
          <div
            className={styles.sorts}
            role="group"
            aria-label={t("home.sortMaps")}
          >
            {sorts.map((sort) => (
              <button
                type="button"
                key={sort}
                aria-pressed={filters.sort === sort}
                onClick={() => update({ sort })}
              >
                {t.data("sort", sort === "popular" ? "popularShort" : sort)}
              </button>
            ))}
          </div>
          <div className={styles.summary}>
            <label className={styles.region}>
              <span className={styles.srOnly}>{t("home.area")}</span>
              <select
                aria-label={t("home.area")}
                value={filters.region}
                onChange={(e) => update({ region: e.target.value })}
              >
                <option value="">{t("home.allAreasOption")}</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {t.data("region", region)}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
            <p role="status" aria-live="polite">
              {t("home.mapCount", { count: results.length })}
            </p>
          </div>
        </div>
        {conditions.length > 0 && (
          <div
            className={styles.conditions}
            aria-label={t("home.selectedFilters")}
          >
            {conditions.map((key) => (
              <button
                type="button"
                key={key}
                aria-label={t("home.removeFilter", {
                  value: conditionName(key) ?? "",
                })}
                onClick={() => update({ [key]: "" })}
              >
                {conditionName(key)}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
            {conditions.length > 1 && (
              <button
                type="button"
                onClick={() => update({ q: "", category: "", region: "" })}
              >
                {t("home.clearAll")}
              </button>
            )}
          </div>
        )}
        {demo && !editor && (
          <p className={styles.note}>
            {t("home.previewPlacesAndRecommendationsAre")}
          </p>
        )}
        {engagement.error && (
          <p className={styles.error} role="alert">
            {t.message(engagement.error)}{" "}
            <button type="button" onClick={() => void engagement.reload()}>
              {t("home.tryAgain")}
            </button>
          </p>
        )}
        <ol className={styles.cards}>
          {results.slice(0, limit).map((map) => {
            const country =
              map.country === "KR"
                ? t("home.korea")
                : map.country === "JP"
                  ? t("home.japan")
                  : map.country;
            const inclusive = Boolean(
              filters.region &&
              map.regions[0] !== filters.region &&
              filters.region !== country,
            );
            return (
              <li
                key={map.id}
                className={styles.card}
                data-catalog-card
                data-editor-selected={
                  editor?.selectedId === map.id || undefined
                }
                data-editor-changed={
                  editor?.changedIds.includes(map.id) || undefined
                }
                data-slug={map.slug}
              >
                <Link
                  href={`/maps/${map.slug}`}
                  prefetch={false}
                  onClick={(event) => {
                    if (editor) {
                      event.preventDefault();
                      editor.onSelect(map.id);
                    } else remember();
                  }}
                  className={styles.cover}
                  aria-label={t(
                    editor ? "home.editMapLabel" : "home.openMapLabel",
                    {
                      title: map.displayTitle,
                    },
                  )}
                >
                  <MapCardBackdrop
                    slug={map.slug}
                    editorial={map.editorial}
                    sharp
                  />
                  <span className={styles.shade} aria-hidden="true" />
                  <div className={styles.heading}>
                    <h3>{map.displayTitle}</h3>
                    <p>
                      {t.data("region", map.regionLabel)}
                      {inclusive
                        ? " " +
                          t("home.includes", {
                            region: t.data("region", filters.region),
                          })
                        : ""}
                      {map.categoryLabel
                        ? ` · ${t.data("categoryLabel", map.categoryLabel)}`
                        : ""}
                    </p>
                  </div>
                  <span className={styles.count}>
                    {rich(
                      t(inclusive ? "home.placeCountAll" : "home.placeCount", {
                        count: map.place_count,
                      }),
                      { small: (chunk) => <small>{chunk}</small> },
                    )}
                  </span>
                </Link>
                {editor &&
                  (editor.selectedId === map.id ||
                    editor.changedIds.includes(map.id)) && (
                    <span className={styles.editorBadge}>
                      {editor.selectedId === map.id
                        ? t("home.editing")
                        : t("home.notApplied")}
                    </span>
                  )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.hype}
                    aria-label={t(
                      engagement.isHyped(map.id)
                        ? "home.unhypeMapLabel"
                        : "home.hypeMapLabel",
                      { title: map.displayTitle },
                    )}
                    title={t("home.totalHypePopularIsBased")}
                    aria-pressed={engagement.isHyped(map.id)}
                    aria-busy={engagement.isPending("hype", map.id)}
                    disabled={
                      !engagement.interactive ||
                      !engagement.ready ||
                      engagement.isPending("hype", map.id)
                    }
                    onClick={() => void engagement.toggle("hype", map.id)}
                  >
                    <span>
                      <Flame
                        size={15}
                        fill={
                          engagement.isHyped(map.id) ? "currentColor" : "none"
                        }
                        aria-hidden="true"
                      />
                      <span>
                        {(map.hype_count ?? 0).toLocaleString("ko-KR")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.save}
                    aria-label={t(
                      engagement.isSaved(map.id)
                        ? "home.unsaveMapLabel"
                        : "home.saveMapLabel",
                      { title: map.displayTitle },
                    )}
                    aria-pressed={engagement.isSaved(map.id)}
                    aria-busy={engagement.isPending("save_map", map.id)}
                    disabled={
                      !engagement.interactive ||
                      !engagement.ready ||
                      engagement.isPending("save_map", map.id)
                    }
                    onClick={() => void engagement.toggle("save_map", map.id)}
                  >
                    <span>
                      <Bookmark
                        size={17}
                        fill={
                          engagement.isSaved(map.id) ? "currentColor" : "none"
                        }
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {!results.length && (
          <div className={styles.empty}>
            <h3>{t("home.noMapsMatchYourFilters")}</h3>
            <p>{t("home.tryRemovingSearchCategoryOr")}</p>
            <button
              type="button"
              onClick={() => update({ q: "", category: "", region: "" })}
            >
              {t("home.clearSearchAndFilters")}
            </button>
          </div>
        )}
        {results.length > limit && (
          <button
            type="button"
            className={styles.more}
            onClick={() =>
              setLimits((value) => ({ ...value, [href]: limit + 24 }))
            }
          >
            {t("home.showMore", {
              shown: Math.min(limit, results.length),
              total: results.length,
            })}
          </button>
        )}
      </section>
    </div>
  );
}
