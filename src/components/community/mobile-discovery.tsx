"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { MobileMapStory } from "./mobile-map-story";
import { useMapEngagement } from "./use-map-engagement";
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
  const engagement = useMapEngagement(maps, demo, "mobile");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dockVisible, setDockVisible] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const stories = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = stories.current;
    const card = list?.querySelector<HTMLElement>(
      'article[data-expanded="true"]',
    );
    if (!list || !card || !expandedId) return;
    // Keep the first two cards in place; centering them creates empty space above.
    if (Array.from(list.children).indexOf(card) < 2) return;
    let frame = 0;
    let centered = false;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const center = () => {
      if (centered) return;
      centered = true;
      if (!card.getClientRects().length) return;
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const offset = viewport?.offsetTop ?? 0;
      const rect = card.getBoundingClientRect();
      const headerBottom =
        document.querySelector(".glass-header")?.getBoundingClientRect()
          .bottom ?? 72;
      const top =
        rect.height > height - headerBottom - 32
          ? Math.max(offset + 16, headerBottom + 16)
          : offset + (height - rect.height) / 2;
      let destination = window.scrollY + rect.top - top;
      // Temporary breathing room lets cards near either edge reach the center.
      if (destination < 0) {
        list.style.paddingTop = `${-destination}px`;
        destination = 0;
      }
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      if (destination > limit)
        list.style.paddingBottom = `${destination - limit}px`;
      window.scrollTo({
        top: destination,
        behavior: reduced ? "instant" : "smooth",
      });
    };
    const afterExpansion = (event: TransitionEvent) => {
      if (event.propertyName === "grid-template-rows") center();
    };
    card.addEventListener("transitionend", afterExpansion);
    const timer = window.setTimeout(center, reduced ? 0 : 340);
    if (reduced) frame = requestAnimationFrame(center);
    const cancel = () => {
      centered = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchmove", cancel, { passive: true });
    return () => {
      cancel();
      if (!reduced)
        window.scrollTo({ top: window.scrollY, behavior: "instant" });
      card.removeEventListener("transitionend", afterExpansion);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchmove", cancel);
      list.style.removeProperty("padding-top");
      list.style.removeProperty("padding-bottom");
    };
  }, [expandedId]);
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
      <p className={styles.introduction}>
        <span className="text-primary">취향 있는 사람들</span>의 추천을 모은
        테마별 지도
      </p>
      <span role="status" className="sr-only">
        {results.length}개 지도
      </span>
      {engagement.error && (
        <p role="alert" className={styles.engagementError}>
          {engagement.error}{" "}
          {!engagement.ready && (
            <button type="button" onClick={() => void engagement.reload()}>
              다시 시도
            </button>
          )}
        </p>
      )}
      <div ref={stories} className={styles.stories}>
        {results.map((map) => (
          <MobileMapStory
            key={map.id}
            map={engagement.withCounts(map)}
            engagement={engagement}
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
      <Link href="/discover" prefetch={false} className={styles.allMaps}>
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
