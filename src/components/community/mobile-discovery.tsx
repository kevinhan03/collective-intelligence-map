"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { MobileMapStory } from "./mobile-map-story";
import styles from "./mobile-discovery.module.css";

export function MobileDiscovery({
  maps,
  locationTerms,
  demo,
}: {
  maps: ThemeMap[];
  locationTerms: Record<string, string>;
  demo: boolean;
}) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dockVisible, setDockVisible] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let previous = window.scrollY;
    const onScroll = () => {
      const y = Math.max(
        0,
        Math.min(
          window.scrollY,
          document.documentElement.scrollHeight - window.innerHeight,
        ),
      );
      if (y < 20) setDockVisible(true);
      else if (Math.abs(y - previous) > 10) setDockVisible(y < previous);
      else return;
      previous = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      dock.current?.style.setProperty(
        "--home-keyboard-offset",
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  const results = maps.filter((map) =>
    `${map.title} ${map.description} ${map.city} ${map.country} ${map.tags.join(" ")} ${locationTerms[map.id] ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const visible = dockVisible || searchFocused;
  return (
    <section
      className={`${styles.discovery} lg:hidden`}
      data-mobile-story-home
      aria-label="테마지도 탐색"
    >
      <h1 className="sr-only">취향으로 찾는 테마지도</h1>
      <span role="status" className="sr-only">
        {results.length}개 지도
      </span>
      <div className={styles.stories}>
        {results.map((map) => (
          <MobileMapStory
            key={map.id}
            map={map}
            expanded={expandedId === map.id}
            onExpand={() => setExpandedId(map.id)}
            onClose={() => setExpandedId(null)}
          />
        ))}
      </div>
      {results.length === 0 && (
        <div className={styles.empty}>
          <p>조건에 맞는 지도가 아직 없어요.</p>
          <button
            onClick={() => {
              setQuery("");
            }}
          >
            검색 조건 초기화
          </button>
        </div>
      )}
      <Link href="/discover" className={styles.allMaps}>
        전체 지도 보기 <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
      {demo && (
        <p className={styles.demo}>미리보기 · 장소와 추천은 가상 예시입니다.</p>
      )}
      <div
        ref={dock}
        className={styles.searchDock}
        data-visible={visible}
        inert={!visible}
        aria-hidden={!visible}
      >
        <div className={styles.searchSurface}>
          <div className={styles.searchRow}>
            <Search size={22} aria-hidden="true" />
            <input
              type="search"
              aria-label="추천 지도 검색"
              placeholder="추천 지도 검색"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setExpandedId(null);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
