"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";
import { MapCardBackdrop } from "@/components/community/map-card-backdrop";
import styles from "./desktop-discovery.module.css";

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
      <ol className={styles.cards}>
        {results.map((map) => (
          <li key={map.id} className={styles.card}>
            <details className={styles.preview}>
              <summary
                className={`${styles.cover} group`}
                aria-label={`${map.title} 미리보기`}
              >
                <MapCardBackdrop slug={map.slug} />
                <span className={styles.shade} aria-hidden="true" />
                <h3 className={styles.title}>{map.title}</h3>
                <span className={styles.count}>
                  {map.place_count.toLocaleString("ko-KR")}
                  <span className={styles.unit}>곳</span>
                </span>
              </summary>
              <div className={styles.description}>
                <p className={styles.location}>{formatLocation(map)}</p>
                <p className={styles.body}>{map.description}</p>
                <p className={styles.followers}>
                  팔로워 {map.follower_count.toLocaleString("ko-KR")}명
                </p>
                <Link
                  href={`/maps/${map.slug}`}
                  className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  전체 지도 열기<span className="sr-only"> · {map.title}</span>
                  <ArrowUpRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </details>
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
