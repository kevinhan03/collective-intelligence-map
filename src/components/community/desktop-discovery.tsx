"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, MapPin, Search, Users } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";
import { MapCardBackdrop } from "@/components/community/map-card-backdrop";

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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 space-y-2">
        <label className="relative block w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <input
            aria-label="지도 검색"
            placeholder="지역이나 관심 있는 테마 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-xl border bg-card pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
      </div>
      <ol className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-black/20 p-3 pr-2 backdrop-blur-xl">
        {results.map((map, i) => (
          <li key={map.id}>
            <Link
              href={`/maps/${map.slug}`}
              className="group relative flex h-full min-h-[182px] flex-col overflow-hidden rounded-lg border border-white/20 bg-[#28323a] p-4 text-white shadow-lg transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-white/50 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <MapCardBackdrop slug={map.slug} />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/25 to-black/65"
              />
              <div className="relative flex items-start justify-between text-xs font-medium text-white/75">
                <span className="tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>
              <h3 className="relative my-auto line-clamp-2 text-center text-xl leading-tight font-semibold tracking-tight drop-shadow-md xl:text-2xl">
                {map.title}
              </h3>
              <div className="relative flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/25 pt-2.5 text-[10px] text-white/90">
                <span className="max-w-full truncate font-medium">
                  {formatLocation(map)}
                </span>
                <span className="flex items-center gap-2.5 whitespace-nowrap text-white/80">
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden="true" size={11} />
                    {map.place_count.toLocaleString("ko-KR")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users aria-hidden="true" size={11} />
                    {map.follower_count.toLocaleString("ko-KR")}
                  </span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {results.length === 0 && (
        <p
          role="status"
          className="py-8 text-center text-sm text-muted-foreground"
        >
          조건에 맞는 지도가 없어요. 다른 지역이나 테마를 검색해 보세요.
        </p>
      )}
    </div>
  );
}
