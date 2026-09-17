"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import type { ThemeMap } from "@/domain/types";

export function MobileDiscovery({
  maps,
  demo,
}: {
  maps: ThemeMap[];
  demo: boolean;
}) {
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const regions = [...new Set(maps.map((map) => `${map.country}|${map.city}`))];
  const regionalMaps = maps.filter(
    (map) => !region || `${map.country}|${map.city}` === region,
  );
  const results = regionalMaps.filter(
    (map) =>
      `${map.title} ${map.description} ${map.city} ${map.tags.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section
      className="mobile-discovery lg:hidden"
      aria-label="지역과 취향으로 지도 찾기"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-primary">
          취향이 모이는 지도
        </span>
        <label className="flex min-w-0 items-center gap-1 text-sm">
          <MapPin size={16} aria-hidden="true" />
          <select
            aria-label="탐색 지역"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="max-w-40 rounded-lg bg-card px-2 py-2"
          >
            <option value="">모든 지역</option>
            {regions.map((value) => (
              <option key={value} value={value}>
                {value.split("|")[1]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h1 className="text-[30px] leading-tight font-semibold tracking-tight">
        오늘은 어떤 곳을
        <br />
        발견하고 싶나요?
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        같은 취향의 사람들이 추천하는 장소를 모았어요.
      </p>
      <div className="relative mt-6">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-4 text-muted-foreground"
        />
        <input
          aria-label="테마 지도 검색"
          placeholder="지역이나 관심 있는 테마 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-12 w-full rounded-2xl border bg-card pr-4 pl-11 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      {demo && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          미리보기 · 장소와 추천 내용은 가상 예시예요.
        </p>
      )}
      <div className="mt-7 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">취향에 맞는 지도</h2>
        <span role="status" className="text-xs text-muted-foreground">
          {results.length}개
        </span>
      </div>
      <div className="space-y-3">
        {results.map((map) => (
          <Link
            key={map.id}
            href={`/maps/${map.slug}`}
            className="mobile-theme-card block rounded-2xl border p-5"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {map.city} · {map.country}
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-xl font-semibold">{map.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {map.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-primary">
              {map.tags
                .filter((tag) => tag !== "전체")
                .map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
            </div>
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              장소 {map.place_count}곳 · 함께 보는 사람 {map.follower_count}명
            </p>
          </Link>
        ))}
        {results.length === 0 && (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="font-medium">조건에 맞는 지도가 아직 없어요.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              다른 지역이나 테마를 찾아보세요.
            </p>
            <button
              className="mt-4 rounded-xl bg-secondary px-5 text-sm"
              onClick={() => {
                setRegion("");
                setQuery("");
              }}
            >
              전체 지도 보기
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
