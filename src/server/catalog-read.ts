import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";
import { configured } from "@/lib/supabase/server";
import { catalogEditorial } from "@/domain/catalog-config";
import {
  catalogImageUrl,
  type CatalogSetting,
  type CatalogValue,
} from "@/domain/catalog-admin";
import type { ThemeMap } from "@/domain/types";
export async function readCatalogSettings(): Promise<CatalogSetting[]> {
  "use cache";
  if (process.env.NODE_ENV === "development") cacheLife("seconds");
  else cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("public-community");
  if (!configured()) return [];
  const { data, error } = await publicDb()
    .from("catalog_settings")
    .select("map_id,value,version");
  // Keep the existing catalog available while the migration is not installed.
  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) throw new Error("홈 설정을 불러오지 못했습니다.");
  return data as unknown as CatalogSetting[];
}
export function resolveEditorial(maps: ThemeMap[], settings: CatalogSetting[]) {
  const byId = new Map(settings.map((s) => [s.map_id, s.value]));
  return Object.fromEntries(
    maps
      .map((m) => {
        const value: CatalogValue | undefined =
          byId.get(m.id) ?? catalogEditorial[m.slug];
        return [
          m.slug,
          value &&
            ({
              ...value,
              image: value.imageId
                ? catalogImageUrl(value.imageId)
                : value.image,
              focalPoint:
                value.focalX === undefined
                  ? value.focalPoint
                  : `${value.focalX}% ${value.focalY}%`,
            } as CatalogValue),
        ];
      })
      .filter(([, value]) => Boolean(value)),
  ) as Record<string, CatalogValue>;
}
