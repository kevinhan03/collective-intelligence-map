"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, MapPin, Search, Users } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";

export function DesktopDiscovery({
  maps,
  locationTerms,
}: {
  maps: ThemeMap[];
  locationTerms: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const results = maps.filter((map) =>
    `${map.title} ${map.description} ${map.city} ${map.country} ${map.tags.join(" ")} ${locationTerms[map.id] ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-6">
        <p className="text-xs text-muted-foreground">
          팔로워 많은 순 · 동률이면 등록 장소 수 기준
        </p>
        <label className="relative block w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            aria-label="지도 검색"
            placeholder="지역이나 관심 있는 테마 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-xl border bg-card pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
      </div>
      <ol className="divide-y divide-white/10 rounded-3xl border border-white/15 bg-black/20 p-3 backdrop-blur-xl">
        {results.map((map, i) => (
          <li key={map.id}>
            <Link
              href={`/maps/${map.slug}`}
              className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-5 rounded-2xl px-5 py-6 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true" className="grid size-16 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <MapPin className="size-7" />
              </span>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight group-hover:text-primary">
                  <span className="tabular-nums">{i + 1}.</span>
                  <span className="truncate">{map.title}</span>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" />
                </h3>
                <p className="mt-1.5 truncate text-base text-muted-foreground" title={map.description}>
                  {map.description}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatLocation(map)}</span>
                  {map.tags.filter((tag) => tag !== "전체").map((tag) => (
                    <span key={tag} className="text-primary/80">#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex min-w-20 flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                  <MapPin aria-hidden="true" size={15} className="text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{map.place_count.toLocaleString("ko-KR")}</span>
                  <span className="text-[10px] text-muted-foreground">장소</span>
                </div>
                <div className="flex min-w-20 flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                  <Users aria-hidden="true" size={15} className="text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{map.follower_count.toLocaleString("ko-KR")}</span>
                  <span className="text-[10px] text-muted-foreground">팔로워</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {results.length === 0 && (
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">
          조건에 맞는 지도가 없어요. 다른 지역이나 테마를 검색해 보세요.
        </p>
      )}
    </>
  );
}
