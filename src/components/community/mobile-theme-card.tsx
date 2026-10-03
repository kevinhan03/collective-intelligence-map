import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";
import { MapCardBackdrop } from "./map-card-backdrop";

export function MobileThemeCard({
  map,
  layout = "card",
}: {
  map: ThemeMap;
  layout?: "card" | "row";
}) {
  if (layout === "row")
    return (
      <Link href={`/maps/${map.slug}`} className="mobile-theme-row">
        <div className="mobile-theme-row-cover" aria-hidden="true">
          <MapCardBackdrop slug={map.slug} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-6">{map.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {map.description}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users size={14} aria-hidden="true" />
            팔로워 {map.follower_count.toLocaleString("ko-KR")}명
          </p>
        </div>
      </Link>
    );
  return (
    <Link
      href={`/maps/${map.slug}`}
      className="mobile-theme-card group block overflow-hidden rounded-xl border"
    >
      <div className="relative h-32 overflow-hidden bg-card" aria-hidden="true">
        <MapCardBackdrop slug={map.slug} />
        <ArrowUpRight
          className="absolute right-3 top-3 rounded-full bg-black/60 p-1 text-white"
          size={28}
        />
      </div>
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">
          {formatLocation(map)} · 장소 {map.place_count}곳
        </p>
        <h3 className="text-xl font-semibold leading-tight">{map.title}</h3>
        <p className="line-clamp-2 text-base leading-6 text-muted-foreground">
          {map.description}
        </p>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {map.tags
            .filter((tag) => tag !== "전체")
            .slice(0, 2)
            .map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
        </div>
      </div>
    </Link>
  );
}
