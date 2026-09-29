"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, MapPin, Search, Users } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";
import { MapCardBackdrop } from "@/components/community/map-card-backdrop";

type SortOrder = "popular" | "places" | "newest";

export function DiscoverMaps({ maps }: { maps: ThemeMap[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [theme, setTheme] = useState("");
  const [sort, setSort] = useState<SortOrder>("popular");
  const regions = [
    ...new Map(
      maps.map((map) => [`${map.country}|${map.city}`, formatLocation(map)]),
    ).entries(),
  ];
  const themes = [
    ...new Set(maps.flatMap((map) => map.tags).filter((tag) => tag !== "전체")),
  ].sort((a, b) => a.localeCompare(b, "ko"));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = maps.filter(
    (map) =>
      (!region || `${map.country}|${map.city}` === region) &&
      (!theme || map.tags.includes(theme)) &&
      (!normalizedQuery ||
        `${map.title} ${map.description} ${map.city} ${map.country} ${map.tags.join(" ")}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)),
  );
  const results = [...filtered].sort((a, b) => {
    if (sort === "newest") return maps.indexOf(b) - maps.indexOf(a);
    if (sort === "places")
      return (
        b.place_count - a.place_count || b.follower_count - a.follower_count
      );
    return b.follower_count - a.follower_count || b.place_count - a.place_count;
  });

  return (
    <div>
      <div className="grid gap-3 rounded-3xl border border-white/15 bg-black/25 p-4 backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center">
        <label className="relative block min-w-0">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground"
          />
          <input
            aria-label="지도 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="지도 이름이나 관심 있는 주제 검색"
            className="h-11 w-full rounded-xl border bg-card pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="sr-only" htmlFor="discover-region">
          지역
        </label>
        <select
          id="discover-region"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          className="h-11 w-full rounded-xl border bg-card px-3 text-sm md:w-36"
        >
          <option value="">모든 지역</option>
          {regions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="discover-theme">
          테마
        </label>
        <select
          id="discover-theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          className="h-11 w-full rounded-xl border bg-card px-3 text-sm md:w-36"
        >
          <option value="">모든 테마</option>
          {themes.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="discover-sort">
          정렬
        </label>
        <select
          id="discover-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOrder)}
          className="h-11 w-full rounded-xl border bg-card px-3 text-sm md:w-36"
        >
          <option value="popular">팔로워순</option>
          <option value="places">장소 많은 순</option>
          <option value="newest">최근 생성순</option>
        </select>
      </div>

      <div className="mt-7 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">전체 지도</h2>
        <span role="status" className="text-sm text-muted-foreground">
          {results.length}개
        </span>
      </div>
      {results.length ? (
        <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((map) => (
            <li key={map.id} className="min-w-0">
              <Link
                href={`/maps/${map.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#15191d] shadow-lg transition-[border-color,transform] hover:-translate-y-1 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="relative flex h-48 items-center justify-center overflow-hidden bg-[#28323a] p-5 text-white">
                  <MapCardBackdrop slug={map.slug} />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/60"
                  />
                  <ArrowUpRight
                    aria-hidden="true"
                    className="absolute top-5 right-5 size-5 text-white/85"
                  />
                  <h3 className="relative line-clamp-2 text-center text-2xl font-semibold tracking-tight drop-shadow-md">
                    {map.title}
                  </h3>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-medium tracking-wide text-primary">
                    {formatLocation(map)}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {map.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {map.tags
                      .filter((tag) => tag !== "전체")
                      .map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                  </div>
                  <div className="mt-auto flex gap-4 border-t border-white/10 pt-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden="true" size={14} />
                      장소 {map.place_count.toLocaleString("ko-KR")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users aria-hidden="true" size={14} />
                      팔로워 {map.follower_count.toLocaleString("ko-KR")}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-3xl border border-white/15 bg-black/20 px-6 py-14 text-center">
          <p className="font-medium">조건에 맞는 지도가 없어요.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            다른 지역이나 테마로 다시 찾아보세요.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRegion("");
              setTheme("");
            }}
            className="mt-5 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
