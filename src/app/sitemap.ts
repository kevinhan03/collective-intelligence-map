import type { MetadataRoute } from "next";
import { canIndex, siteOrigin } from "@/lib/seo";
import { creatorCatalog } from "@/server/creator";
import { getMaps } from "@/server/queries";
import { getPublicPlaceUrls } from "@/server/seo-queries";
import { placePath } from "@/domain/seo";
import { areaPath, seoAreas } from "@/domain/seo-areas";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!canIndex) return [];
  const creators = await creatorCatalog();
  const maps = [
    ...(await getMaps()),
    ...creators.map((item) => ({
      ...item.map,
      place_count: 0,
      follower_count: 0,
      contributor_count: 0,
    })),
  ];
  const places = await getPublicPlaceUrls(maps);
  const slugs = new Map(maps.map((m) => [m.id, m.slug]));
  const urls = new Set([
    "/",
    "/discover",
    "/terms",
    "/privacy",
    ...creators.map((item) => `/u/${item.handle}`),
    ...maps.flatMap((m) => [`/maps/${m.slug}`, `/maps/${m.slug}/places`]),
    ...maps.flatMap((m) =>
      seoAreas(places.filter((p) => p.map_id === m.id)).map((area) =>
        areaPath(m.slug, area.key),
      ),
    ),
    ...places.flatMap((p) =>
      slugs.has(p.map_id) ? [placePath(slugs.get(p.map_id)!, p.place_id)] : [],
    ),
  ]);
  return [...urls].map((path) => ({ url: `${siteOrigin}${path}` }));
}
