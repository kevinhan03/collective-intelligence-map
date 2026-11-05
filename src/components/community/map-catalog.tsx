"use client";
import Link from "@/i18n/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Leaf,
  Mountain,
  Search,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { catalogCategories } from "@/domain/catalog-config";
import {
  catalogHref,
  catalogSorts,
  filterCatalog,
  homeCatalog,
  parseCatalogFilters,
  type CatalogFilters,
  type CatalogMap,
} from "@/domain/map-catalog";
import { CatalogCard } from "./catalog-card";
import { useMapEngagement } from "./use-map-engagement";
import styles from "./map-catalog.module.css";

import { useI18n } from "@/i18n/client";
const categoryIcons = {
  food: UtensilsCrossed,
  fashion: ShoppingBag,
  travel: Mountain,
  rest: Leaf,
};
const storageKey = (key: string) => `ting:catalog:${key}`;
type SavedList = { limit: number; scroll: number };
export function MapCatalog({
  maps,
  mode,
  demo = false,
  engagementSurface = "all",
  editor,
}: {
  maps: CatalogMap[];
  mode: "home" | "discover";
  demo?: boolean;
  engagementSurface?: "all" | "mobile";
  editor?: {
    filters: CatalogFilters;
    onFiltersChange: (filters: CatalogFilters) => void;
    selectedId: string;
    onSelect: (id: string) => void;
    onNavigate: (mode: "home" | "discover") => void;
  };
}) {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const deviceMobile = useMobile();
  const editorMode = Boolean(editor);
  const mobile = editorMode || deviceMobile;
  const engagement = useMapEngagement(maps, demo, engagementSurface);
  const enriched = maps.map((map) => engagement.withCounts(map));
  const parsedFilters = parseCatalogFilters(
    new URLSearchParams(params.toString()),
    maps,
  );
  const currentFilters = editor?.filters ?? parsedFilters;
  const filters: CatalogFilters = mobile
    ? { ...currentFilters, region: "", theme: "", sort: "default" }
    : currentFilters;
  const resultKey = mode === "home" ? "/" : catalogHref(filters);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const limit = limits[resultKey] ?? 24;
  const limitRef = useRef(limit);
  const skipRestore = useRef(false);
  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);
  const heading = useRef<HTMLHeadingElement>(null);
  const results = filterCatalog(enriched, filters);
  const selection = homeCatalog(enriched);
  const regions = [...new Set(maps.flatMap((map) => map.regions))].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
  const themes = [
    ...new Set([
      ...maps
        .filter(
          (map) =>
            !filters.category || map.catalogCategory === filters.category,
        )
        .flatMap((map) => map.tags),
      ...(filters.theme ? [filters.theme] : []),
    ]),
  ]
    .filter((tag) => tag !== "전체")
    .sort((a, b) => a.localeCompare(b, "ko"));

  useEffect(() => {
    if (editorMode) return;
    let active = true;
    let frame = 0;
    let scrollFrame = 0;
    try {
      const saved: SavedList | null = JSON.parse(
        sessionStorage.getItem(storageKey(resultKey)) ?? "null",
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
            [resultKey]: Math.max(24, Math.min(maps.length, saved.limit)),
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
      /* Storage is optional, including in private browsing. */
    }
    skipRestore.current = false;
    const save = () => {
      try {
        sessionStorage.setItem(
          storageKey(resultKey),
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
  }, [resultKey, maps.length, editorMode]);
  function remember() {
    if (editor) return;
    try {
      sessionStorage.setItem(
        storageKey(resultKey),
        JSON.stringify({ limit, scroll: window.scrollY }),
      );
    } catch {
      /* optional */
    }
  }
  function update(patch: Partial<CatalogFilters>) {
    if (editor) {
      editor.onFiltersChange({ ...filters, ...patch });
      editor.onNavigate("discover");
      return;
    }
    remember();
    skipRestore.current = true;
    router.push(catalogHref({ ...filters, ...patch }), { scroll: true });
  }
  const fields = (
    <>
      <label>
        {t("home.area")}
        <select
          aria-label={t("home.area")}
          value={filters.region}
          onChange={(e) => update({ region: e.target.value })}
        >
          <option value="">{t("home.allAreas")}</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {t.data("region", region)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("home.subThemes")}
        <select
          aria-label={t("home.subThemes")}
          value={filters.theme}
          onChange={(e) => update({ theme: e.target.value })}
        >
          <option value="">{t("home.allThemes")}</option>
          {themes.map((theme) => (
            <option key={theme} value={theme}>
              {t.data("theme", theme)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("home.sort")}
        <select
          aria-label={t("home.sort")}
          value={filters.sort}
          onChange={(e) =>
            update({ sort: e.target.value as CatalogFilters["sort"] })
          }
        >
          {catalogSorts.map((sort) => (
            <option key={sort.id} value={sort.id}>
              {sort.id === "default" && filters.q.trim()
                ? t("home.mostRelevant")
                : t.data("sort", sort.id)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  const activeConditions = (
    ["q", "category", "region", "theme", "sort"] as const
  ).filter(
    (key) => filters[key] && !(key === "sort" && filters.sort === "default"),
  );
  const conditionName = (key: (typeof activeConditions)[number]) =>
    key === "category"
      ? t.data("category", filters.category)
      : key === "sort"
        ? t.data("sort", filters.sort)
        : key === "q"
          ? filters.q
          : t.data(key, filters[key]);
  return (
    <div
      className={styles.catalog}
      data-map-catalog={mode}
      data-editor-mode={editorMode || undefined}
    >
      {mode === "home" ? (
        <h1 className={styles.srOnly}>{t("home.themeMapsToMatchYour")}</h1>
      ) : (
        <div className={styles.discoveryHeading}>
          <Link
            href="/"
            onClick={(event) => {
              if (editor) {
                event.preventDefault();
                editor.onNavigate("home");
                editor.onFiltersChange({ ...filters, q: "", category: "" });
              } else remember();
            }}
          >
            {t("home.home")}
          </Link>
          <h1>
            {filters.category
              ? t.data("category", filters.category)
              : t("home.allMaps")}
          </h1>
          <p>{t("home.findMapsYouLlWant")}</p>
        </div>
      )}
      <form
        key={filters.q}
        className={styles.search}
        role="search"
        aria-label={t("home.findThemeMaps")}
        onSubmit={(e) => {
          e.preventDefault();
          const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
          update({ q });
        }}
      >
        <Search size={20} aria-hidden="true" />
        <input
          name="q"
          type="search"
          maxLength={100}
          aria-label={t("home.searchMaps")}
          placeholder={t("home.findMapsByThemeOr")}
          defaultValue={mode === "home" ? "" : filters.q}
        />
        <button type="submit" aria-label={t("home.showMapResults")}>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </form>
      <nav className={styles.categories} aria-label={t("home.mapCategories")}>
        {catalogCategories.map((category) => {
          const Icon = categoryIcons[category.id];
          return (
            <Link
              key={category.id}
              href={catalogHref(
                mode === "home"
                  ? { category: category.id }
                  : {
                      ...filters,
                      category:
                        filters.category === category.id ? "" : category.id,
                      theme: "",
                    },
              )}
              aria-current={
                mode === "discover" && filters.category === category.id
                  ? "page"
                  : undefined
              }
              onClick={(event) => {
                if (editor) {
                  event.preventDefault();
                  update({ category: category.id });
                  return;
                }
                remember();
                skipRestore.current = true;
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {t.data("category", category.id)}
            </Link>
          );
        })}
      </nav>
      {engagement.error && (
        <p className={styles.error} role="alert">
          {t.message(engagement.error)}
          {!engagement.ready && (
            <button type="button" onClick={() => void engagement.reload()}>
              {t("home.tryAgain")}
            </button>
          )}
        </p>
      )}
      {demo && !editor && (
        <p className={styles.demo}>
          {t("home.previewPlacesAndRecommendationsAre")}
        </p>
      )}
      {mode === "home" ? (
        <>
          {selection.featured && (
            <section
              className={styles.section}
              aria-label={t("home.mapsToExploreNow")}
            >
              <h2>{t("home.mapsToExploreNow")}</h2>
              <CatalogCard
                map={selection.featured}
                engagement={engagement}
                featured
                onSelect={
                  editor
                    ? () => editor.onSelect(selection.featured!.id)
                    : undefined
                }
                selected={editor?.selectedId === selection.featured.id}
                onNavigate={remember}
              />
            </section>
          )}
          <section className={styles.section} aria-label={t("home.moreThemes")}>
            <div className={styles.sectionHeader}>
              <h2>{t("home.moreThemes")}</h2>
              <Link
                href="/discover"
                onClick={(event) => {
                  if (editor) {
                    event.preventDefault();
                    editor.onNavigate("discover");
                  } else remember();
                }}
              >
                {t("home.seeAll")} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ul className={styles.grid}>
              {selection.items.map((map) => (
                <li key={map.id}>
                  <CatalogCard
                    map={map}
                    engagement={engagement}
                    onSelect={
                      editor ? () => editor.onSelect(map.id) : undefined
                    }
                    selected={editor?.selectedId === map.id}
                    onNavigate={remember}
                  />
                </li>
              ))}
            </ul>
            {!maps.length && (
              <p className={styles.empty}>{t("home.weReGettingPublicMaps")}</p>
            )}
            <Link
              href="/discover"
              className={styles.allMaps}
              onClick={(event) => {
                if (editor) {
                  event.preventDefault();
                  editor.onNavigate("discover");
                } else remember();
              }}
            >
              {t("home.viewAllMapsCount", { count: maps.length })}{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
        </>
      ) : (
        <>
          <div className={styles.desktopFilters}>{fields}</div>
          <div className={styles.resultToolbar}>
            <p role="status" aria-live="polite">
              {t("home.mapCount", { count: results.length })}
            </p>
          </div>
          {activeConditions.length > 0 && (
            <div
              className={styles.conditions}
              aria-label={t("home.selectedFilters")}
            >
              {activeConditions.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    update({ [key]: key === "sort" ? "default" : "" })
                  }
                  aria-label={t("home.removeFilter", {
                    value: conditionName(key),
                  })}
                >
                  {conditionName(key)}
                  <X size={13} aria-hidden="true" />
                </button>
              ))}
              {activeConditions.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    update({
                      q: "",
                      category: "",
                      region: "",
                      theme: "",
                      sort: "default",
                    })
                  }
                >
                  {t("home.clearAll")}
                </button>
              )}
            </div>
          )}
          {filters.sort === "popular" && (
            <p className={styles.sortNote}>{t("home.rankingIsBasedOnHype")}</p>
          )}
          <h2 ref={heading} tabIndex={-1} className={styles.srOnly}>
            {t("home.mapSearchResults")}
          </h2>
          {results.length ? (
            <>
              <ul className={styles.grid}>
                {results.slice(0, limit).map((map) => (
                  <li key={map.id}>
                    <CatalogCard
                      map={map}
                      engagement={engagement}
                      region={filters.region}
                      onSelect={
                        editor ? () => editor.onSelect(map.id) : undefined
                      }
                      selected={editor?.selectedId === map.id}
                      onNavigate={remember}
                    />
                  </li>
                ))}
              </ul>
              {results.length > limit && (
                <button
                  type="button"
                  className={styles.more}
                  onClick={() => {
                    const next = limit + 24;
                    setLimits((value) => ({ ...value, [resultKey]: next }));
                    try {
                      sessionStorage.setItem(
                        storageKey(resultKey),
                        JSON.stringify({ limit: next, scroll: window.scrollY }),
                      );
                    } catch {}
                  }}
                >
                  {t("home.showMoreButton")}{" "}
                  <span>
                    {Math.min(limit, results.length)} / {results.length}
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <h2>{t("home.noMapsMatchYourFilters")}</h2>
              <p>{t("home.tryRemovingFiltersOneAt")}</p>
              {filters.region && (
                <button type="button" onClick={() => update({ region: "" })}>
                  {t("home.removeAreaOnly")}
                </button>
              )}
              {filters.category && (
                <button
                  type="button"
                  onClick={() => update({ category: "", theme: "" })}
                >
                  {t("home.seeOtherCategories")}
                </button>
              )}
              {filters.q && (
                <button type="button" onClick={() => update({ q: "" })}>
                  {t("home.clearSearch")}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
