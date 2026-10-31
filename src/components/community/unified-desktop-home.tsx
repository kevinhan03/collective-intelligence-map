"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

type SavedPosition = { limit: number; scroll: number };
const sorts = [
  { id: "popular", label: "인기순" },
  { id: "saved", label: "저장순" },
  { id: "newest", label: "최근 생성순" },
] as const;

export function UnifiedDesktopHome({
  maps,
  demo = false,
}: {
  maps: CatalogMap[];
  demo?: boolean;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const filters = parseUnifiedCatalogFilters(
    new URLSearchParams(params.toString()),
    maps,
  );
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
  }, [href, storageKey, maps.length]);

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
      ? catalogCategories.find((c) => c.id === filters.category)?.label
      : filters[key];

  return (
    <div
      className={styles.catalog}
      data-unified-desktop-home
      data-map-catalog="unified"
    >
      <section className={styles.intro} aria-label="취향으로 지도 찾기">
        <h1>
          같은 <span>취향</span>이 모이는 지도
        </h1>
        <p>취향 있는 사람들의 추천으로, 다음 장소를 발견하세요.</p>
        <form
          key={filters.q}
          className={styles.search}
          role="search"
          aria-label="테마 지도 찾기"
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
            aria-label="지도 검색"
            defaultValue={filters.q}
            placeholder="지역이나 관심 있는 테마 검색"
          />
          {filters.q && (
            <button
              type="button"
              className={styles.clear}
              aria-label="검색어 지우기"
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
            aria-label="지도 검색 결과 보기"
          >
            <ArrowRight size={22} />
          </button>
        </form>
        <nav className={styles.categories} aria-label="지도 카테고리">
          {[{ id: "", label: "전체" }, ...catalogCategories].map((c) => (
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
              onClick={() => {
                remember();
                skipRestore.current = true;
              }}
            >
              {c.label}
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
          지도 검색 결과
        </h2>
        <div className={styles.toolbar}>
          <div className={styles.sorts} role="group" aria-label="지도 정렬">
            {sorts.map((sort) => (
              <button
                type="button"
                key={sort.id}
                aria-pressed={filters.sort === sort.id}
                onClick={() => update({ sort: sort.id })}
              >
                {sort.label}
              </button>
            ))}
          </div>
          <div className={styles.summary}>
            <label className={styles.region}>
              <span className={styles.srOnly}>지역</span>
              <select
                aria-label="지역"
                value={filters.region}
                onChange={(e) => update({ region: e.target.value })}
              >
                <option value="">지역 전체</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
            <p role="status" aria-live="polite">
              지도 {results.length.toLocaleString("ko-KR")}개
            </p>
          </div>
        </div>
        {conditions.length > 0 && (
          <div className={styles.conditions} aria-label="선택한 검색 조건">
            {conditions.map((key) => (
              <button
                type="button"
                key={key}
                aria-label={`${conditionName(key)} 조건 해제`}
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
                모두 해제
              </button>
            )}
          </div>
        )}
        {demo && (
          <p className={styles.note}>
            미리보기 · 장소와 추천은 가상 예시입니다.
          </p>
        )}
        {engagement.error && (
          <p className={styles.error} role="alert">
            {engagement.error}{" "}
            <button type="button" onClick={() => void engagement.reload()}>
              다시 시도
            </button>
          </p>
        )}
        <ol className={styles.cards}>
          {results.slice(0, limit).map((map) => {
            const country =
              map.country === "KR"
                ? "한국"
                : map.country === "JP"
                  ? "일본"
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
                data-slug={map.slug}
              >
                <Link
                  href={`/maps/${map.slug}`}
                  prefetch={false}
                  onClick={remember}
                  className={styles.cover}
                  aria-label={`${map.displayTitle} 지도 열기`}
                >
                  <MapCardBackdrop slug={map.slug} sharp />
                  <span className={styles.shade} aria-hidden="true" />
                  <div className={styles.heading}>
                    <h3>{map.displayTitle}</h3>
                    <p>
                      {map.regionLabel}
                      {inclusive ? ` · ${filters.region} 포함` : ""}
                      {map.categoryLabel ? ` · ${map.categoryLabel}` : ""}
                    </p>
                  </div>
                  <span className={styles.count}>
                    {inclusive && <small>전체 </small>}
                    {map.place_count.toLocaleString("ko-KR")}
                    <small>곳</small>
                  </span>
                </Link>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.hype}
                    aria-label={`${map.displayTitle} Hype ${engagement.isHyped(map.id) ? "취소" : "추천"}`}
                    title="누적 Hype · 인기순은 최근 7일 기준"
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
                    aria-label={`${map.displayTitle} 지도 ${engagement.isSaved(map.id) ? "저장 취소" : "저장"}`}
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
            <h3>조건에 맞는 지도가 없어요.</h3>
            <p>검색어나 카테고리, 지역 조건을 해제해 보세요.</p>
            <button
              type="button"
              onClick={() => update({ q: "", category: "", region: "" })}
            >
              검색·필터 초기화
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
            더 보기 · {Math.min(limit, results.length)} / {results.length}
          </button>
        )}
      </section>
    </div>
  );
}
