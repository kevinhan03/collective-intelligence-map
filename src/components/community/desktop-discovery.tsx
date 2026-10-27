"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Flame,
  Search,
  X,
} from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";
import { MapCardBackdrop } from "@/components/community/map-card-backdrop";
import { mapTheme } from "@/domain/map-order";
import { rankMaps, type MapSort } from "@/domain/map-engagement";
import { useMapEngagement } from "./use-map-engagement";
import styles from "./desktop-discovery.module.css";

export function DesktopDiscovery({
  maps,
  locationTerms,
  demo = false,
}: {
  maps: ThemeMap[];
  locationTerms: Record<string, string>;
  demo?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MapSort>("popular");
  const engagement = useMapEngagement(maps, demo);
  const heading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState("all");
  const router = useRouter();
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const themes = [
    { id: "all", label: "전체", pattern: null },
    {
      id: "fashion",
      label: "패션",
      pattern: /패션|빈티지|편집숍|브랜드|fashion|vintage/i,
    },
    {
      id: "food",
      label: "맛집",
      pattern: /맛집|타코|버거|라멘|음식|restaurant|burger|ramen|taco/i,
    },
    {
      id: "leisure",
      label: "여행·휴식",
      pattern: /여행|휴식|야경|사우나|sauna|night view/i,
    },
  ];
  const activeTheme = themes.find((item) => item.id === theme)!;
  const results = rankMaps(
    maps.map(engagement.withCounts).filter((map) => {
      const matchesTheme =
        !activeTheme.pattern ||
        activeTheme.pattern.test(`${map.title} ${map.tags.join(" ")}`);
      const text = `${map.title} ${map.description} ${map.city} ${map.country} ${map.tags.join(" ")} ${locationTerms[map.id] ?? ""}`;
      return (
        matchesTheme && text.toLowerCase().includes(query.trim().toLowerCase())
      );
    }),
    sort,
  );
  const reset = () => {
    setQuery("");
    setTheme("all");
    searchInput.current?.focus();
  };

  return (
    <div className={styles.discovery} data-desktop-home>
      <section className={styles.intro} aria-label="취향으로 지도 찾기">
        <h1 className={styles.headline}>
          같은 <span>취향</span>이 모이는 지도
        </h1>
        <p className={styles.lead}>
          취향 있는 사람들의 추천으로, 다음 장소를 발견하세요.
        </p>
        <form
          className={styles.search}
          role="search"
          aria-label="테마 지도 찾기"
          onSubmit={(event) => {
            event.preventDefault();
            heading.current?.focus({ preventScroll: true });
            heading.current?.scrollIntoView({
              block: "start",
              behavior: "instant",
            });
          }}
        >
          <Search aria-hidden="true" size={20} />
          <input
            ref={searchInput}
            type="search"
            aria-label="지도 검색"
            placeholder="지역이나 관심 있는 테마 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className={styles.clear}
              aria-label="검색어 지우기"
              onClick={() => {
                setQuery("");
                searchInput.current?.focus({ preventScroll: true });
              }}
            >
              <X size={17} />
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
        <div className={styles.themes} role="group" aria-label="지도 테마">
          {themes.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={theme === item.id}
              onClick={() => setTheme(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <section id="communities" aria-labelledby="desktop-maps-heading">
        <div className={styles.sectionHeading}>
          <h2
            id="desktop-maps-heading"
            className="sr-only"
            ref={heading}
            tabIndex={-1}
          >
            지도 목록
          </h2>
          <div className={styles.sorting}>
            <div role="group" aria-label="지도 정렬">
              {(
                [
                  { id: "popular", label: "인기순" },
                  { id: "saved", label: "저장순" },
                  { id: "newest", label: "최신순" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={sort === item.id}
                  onClick={() => setSort(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span>
              {sort === "popular"
                ? "최근 7일 Hype 기준"
                : sort === "saved"
                  ? "지도 저장 수 기준"
                  : "최근 추가된 지도부터"}
            </span>
          </div>
          <p role="status" aria-live="polite">
            {query.trim() || theme !== "all" ? `전체 ${maps.length}개 중 ` : ""}
            {results.length}개의 지도
          </p>
        </div>
        {demo && (
          <p className={styles.demo}>
            미리보기 모드입니다. 장소는 화면 확인을 위한 가상 예시이며 실제
            추천·검증 데이터가 아닙니다.
          </p>
        )}
        {engagement.error && (
          <p className={styles.actionError} role="alert">
            {engagement.error}{" "}
            <button type="button" onClick={() => void engagement.reload()}>
              다시 시도
            </button>
          </p>
        )}
        <ol className={styles.cards}>
          {results.map((map) => (
            <li key={map.id} className={styles.card}>
              <details
                className={styles.preview}
                open={expandedMapId === map.id}
                onToggle={(event) => {
                  if (event.currentTarget.open) {
                    setExpandedMapId(map.id);
                    router.prefetch(`/maps/${map.slug}`);
                    return;
                  }

                  setExpandedMapId((currentMapId) =>
                    currentMapId === map.id ? null : currentMapId,
                  );
                }}
              >
                <summary
                  className={`${styles.cover} group`}
                  aria-label={`${map.title} 미리보기`}
                >
                  <MapCardBackdrop slug={map.slug} sharp />
                  <span className={styles.shade} aria-hidden="true" />
                  <div className={styles.heading}>
                    <h3 className={styles.title}>{map.title}</h3>
                    <p className={styles.metadata}>
                      {map.slug === "seoul-taco-restaurant"
                        ? "서울"
                        : formatLocation(map)}{" "}
                      · {map.slug === "tokyo-fashion" ? "패션" : mapTheme(map)}
                    </p>
                  </div>
                  <span className={styles.count}>
                    {map.place_count ? (
                      <>
                        {map.place_count.toLocaleString("ko-KR")}
                        <span className={styles.unit}>곳</span>
                      </>
                    ) : (
                      <span className={styles.emptyCount}>첫 장소 모집 중</span>
                    )}
                  </span>
                </summary>
                <div className={styles.description}>
                  <p className={styles.location}>{formatLocation(map)}</p>
                  <p className={styles.body}>{map.description}</p>
                  {!map.place_count && (
                    <Link
                      className="inline-block py-3 text-sm text-primary underline"
                      href={`/maps/${map.slug}/submit`}
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
                  <Link
                    href={`/maps/${map.slug}`}
                    prefetch={false}
                    className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    전체 지도 열기
                    <span className="sr-only"> · {map.title}</span>
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </details>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.hypeButton}
                  aria-label={`${map.title} Hype ${engagement.isHyped(map.id) ? "취소" : "추천"}`}
                  title="이 지도 추천하기"
                  aria-pressed={engagement.isHyped(map.id)}
                  aria-busy={engagement.isPending("hype", map.id)}
                  disabled={
                    demo ||
                    !engagement.ready ||
                    engagement.isPending("hype", map.id)
                  }
                  onClick={() => void engagement.toggle("hype", map.id)}
                >
                  <Flame
                    size={17}
                    fill={engagement.isHyped(map.id) ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                  <span>{(map.hype_count ?? 0).toLocaleString("ko-KR")}</span>
                </button>
                <button
                  type="button"
                  className={styles.saveButton}
                  aria-label={`${map.title} 지도 ${engagement.isSaved(map.id) ? "저장 취소" : "저장"}`}
                  title={
                    engagement.isSaved(map.id) ? "지도 저장 취소" : "지도 저장"
                  }
                  aria-pressed={engagement.isSaved(map.id)}
                  aria-busy={engagement.isPending("save_map", map.id)}
                  disabled={
                    demo ||
                    !engagement.ready ||
                    engagement.isPending("save_map", map.id)
                  }
                  onClick={() => void engagement.toggle("save_map", map.id)}
                >
                  <Bookmark
                    size={18}
                    fill={engagement.isSaved(map.id) ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </li>
          ))}
        </ol>
        {results.length === 0 && (
          <p
            role="status"
            className="py-8 text-center text-sm text-muted-foreground"
          >
            조건에 맞는 지도가 없어요. 다른 지역이나 테마를 검색해 보세요.
            <button type="button" className={styles.reset} onClick={reset}>
              검색·필터 초기화
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
