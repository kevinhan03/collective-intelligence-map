"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Leaf,
  Mountain,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
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
}: {
  maps: CatalogMap[];
  mode: "home" | "discover";
  demo?: boolean;
  engagementSurface?: "all" | "mobile";
}) {
  const params = useSearchParams();
  const router = useRouter();
  const engagement = useMapEngagement(maps, demo, engagementSurface);
  const enriched = maps.map((map) => engagement.withCounts(map));
  const filters = parseCatalogFilters(
    new URLSearchParams(params.toString()),
    maps,
  );
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
  }, [resultKey, maps.length]);
  function remember() {
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
    remember();
    skipRestore.current = true;
    router.push(catalogHref({ ...filters, ...patch }), { scroll: true });
  }
  const fields = (
    <>
      <label>
        지역
        <select
          aria-label="지역"
          value={filters.region}
          onChange={(e) => update({ region: e.target.value })}
        >
          <option value="">모든 지역</option>
          {regions.map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
      </label>
      <label>
        세부 테마
        <select
          aria-label="세부 테마"
          value={filters.theme}
          onChange={(e) => update({ theme: e.target.value })}
        >
          <option value="">모든 테마</option>
          {themes.map((theme) => (
            <option key={theme}>{theme}</option>
          ))}
        </select>
      </label>
      <label>
        정렬
        <select
          aria-label="정렬"
          value={filters.sort}
          onChange={(e) =>
            update({ sort: e.target.value as CatalogFilters["sort"] })
          }
        >
          {catalogSorts.map((sort) => (
            <option key={sort.id} value={sort.id}>
              {sort.id === "default" && filters.q.trim()
                ? "관련도순"
                : sort.label}
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
      ? catalogCategories.find((c) => c.id === filters.category)?.label
      : key === "sort"
        ? catalogSorts.find((s) => s.id === filters.sort)?.label
        : filters[key];
  return (
    <div className={styles.catalog} data-map-catalog={mode}>
      {mode === "home" ? (
        <h1 className={styles.srOnly}>취향으로 찾는 테마 지도</h1>
      ) : (
        <div className={styles.discoveryHeading}>
          <Link href="/" onClick={remember}>
            홈
          </Link>
          <h1>
            {catalogCategories.find((c) => c.id === filters.category)?.label ??
              "전체 지도"}
          </h1>
          <p>테마와 지역으로, 가보고 싶은 지도를 찾아보세요.</p>
        </div>
      )}
      <form
        key={filters.q}
        className={styles.search}
        role="search"
        aria-label="테마 지도 찾기"
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
          aria-label="지도 검색"
          placeholder="테마나 지역으로 지도 찾기"
          defaultValue={mode === "home" ? "" : filters.q}
        />
        <button type="submit" aria-label="지도 검색 결과 보기">
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </form>
      <nav className={styles.categories} aria-label="지도 카테고리">
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
              onClick={() => {
                remember();
                skipRestore.current = true;
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {category.label}
            </Link>
          );
        })}
      </nav>
      {engagement.error && (
        <p className={styles.error} role="alert">
          {engagement.error}
          {!engagement.ready && (
            <button type="button" onClick={() => void engagement.reload()}>
              다시 시도
            </button>
          )}
        </p>
      )}
      {demo && (
        <p className={styles.demo}>미리보기 · 장소와 추천은 가상 예시입니다.</p>
      )}
      {mode === "home" ? (
        <>
          {selection.featured && (
            <section className={styles.section} aria-label="지금 둘러볼 지도">
              <h2>지금 둘러볼 지도</h2>
              <CatalogCard
                map={selection.featured}
                engagement={engagement}
                featured
                onNavigate={remember}
              />
            </section>
          )}
          <section className={styles.section} aria-label="더 많은 테마">
            <div className={styles.sectionHeader}>
              <h2>더 많은 테마</h2>
              <Link href="/discover" onClick={remember}>
                전체 보기 <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ul className={styles.grid}>
              {selection.items.map((map) => (
                <li key={map.id}>
                  <CatalogCard
                    map={map}
                    engagement={engagement}
                    onNavigate={remember}
                  />
                </li>
              ))}
            </ul>
            {!maps.length && (
              <p className={styles.empty}>공개된 지도를 준비하고 있어요.</p>
            )}
            <Link
              href="/discover"
              className={styles.allMaps}
              onClick={remember}
            >
              전체 지도 {maps.length}개 보기{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
        </>
      ) : (
        <>
          <div className={styles.desktopFilters}>{fields}</div>
          <div className={styles.resultToolbar}>
            <p role="status" aria-live="polite">
              지도 {results.length.toLocaleString("ko-KR")}개
            </p>
            <Dialog>
              <DialogTrigger className={styles.filterTrigger}>
                <SlidersHorizontal size={16} aria-hidden="true" /> 필터
              </DialogTrigger>
              <DialogContent className={styles.filterSheet}>
                <DialogTitle>지도 필터</DialogTitle>
                <DialogDescription>
                  지역, 세부 테마와 정렬을 선택하세요.
                </DialogDescription>
                <div className={styles.sheetFields}>{fields}</div>
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() =>
                    update({ region: "", theme: "", sort: "default" })
                  }
                >
                  필터 초기화
                </button>
                <DialogClose className={styles.apply}>
                  결과 {results.length}개 보기
                </DialogClose>
              </DialogContent>
            </Dialog>
          </div>
          {activeConditions.length > 0 && (
            <div className={styles.conditions} aria-label="선택한 검색 조건">
              {activeConditions.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    update({ [key]: key === "sort" ? "default" : "" })
                  }
                  aria-label={`${conditionName(key)} 조건 해제`}
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
                  모두 해제
                </button>
              )}
            </div>
          )}
          {filters.sort === "popular" && (
            <p className={styles.sortNote}>
              순위는 최근 7일 Hype 기준이며, 카드에는 누적 Hype가 표시됩니다.
            </p>
          )}
          <h2 ref={heading} tabIndex={-1} className={styles.srOnly}>
            지도 검색 결과
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
                  더 보기{" "}
                  <span>
                    {Math.min(limit, results.length)} / {results.length}
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <h2>조건에 맞는 지도가 없어요.</h2>
              <p>선택한 조건을 하나씩 해제해 보세요.</p>
              {filters.region && (
                <button type="button" onClick={() => update({ region: "" })}>
                  지역만 해제
                </button>
              )}
              {filters.category && (
                <button
                  type="button"
                  onClick={() => update({ category: "", theme: "" })}
                >
                  다른 카테고리 보기
                </button>
              )}
              {filters.q && (
                <button type="button" onClick={() => update({ q: "" })}>
                  검색어 지우기
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
