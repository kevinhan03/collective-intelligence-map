import "server-only";
import { cache } from "react";
import { publicDb } from "@/lib/supabase/public";
import type { MapPlace } from "@/domain/types";
import {
  uniqueRecommendedPlaces,
  type RecommendedPlace,
} from "@/domain/profile";

// Public-only invoker view: owner preview has no broader visibility than visitors.
export const recommendedPlaces = cache(
  async (userId: string): Promise<RecommendedPlace[]> => {
    const client = publicDb();
    const rows: MapPlace[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("map_place_cards")
        .select("*")
        .eq("added_by", userId)
        .in("status", ["approved", "disputed"])
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (error) throw new Error("내가 추천한 장소를 불러오지 못했습니다.");
      rows.push(...((data ?? []) as unknown as MapPlace[]));
      if (!data || data.length < 500) break;
    }
    const unique = uniqueRecommendedPlaces(rows);
    const ids = [...new Set(unique.map((row) => row.map_id))];
    const maps = new Map<
      string,
      { slug: string; title: string; kind: string }
    >();
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await client
        .from("theme_maps")
        .select("id,slug,title,kind")
        .in("id", ids.slice(i, i + 100))
        .eq("status", "published");
      if (error)
        throw new Error("추천 장소의 공개 지도를 불러오지 못했습니다.");
      for (const map of data ?? []) maps.set(map.id, map);
    }
    return unique.flatMap((place) => {
      const map = maps.get(place.map_id);
      if (!map) return [];
      return [
        {
          ...place,
          source_map_slug: map.slug,
          source_map_title: map.title,
          source_map_kind:
            map.kind === "creator"
              ? ("creator" as const)
              : ("community" as const),
        },
      ];
    });
  },
);
