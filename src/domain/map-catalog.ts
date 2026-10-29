import type { ThemeMap } from "./types";
import {
  catalogCategories,
  catalogEditorial,
  type CatalogCategory,
} from "./catalog-config";
import { formatLocation, regionName } from "./location";

export type CatalogMap = ThemeMap & {
  displayTitle: string;
  catalogCategory: CatalogCategory | null;
  categoryLabel: string;
  regionLabel: string;
  regions: string[];
  searchTerms: string[];
  editorialOrder: number;
  featured: boolean;
  featureReason: string;
};
export type RegionSummary = Record<string, string[]>;
export const catalogSorts = [
  { id: "default", label: "기본순" },
  { id: "popular", label: "최근 7일 Hype순" },
  { id: "saved", label: "저장순" },
  { id: "newest", label: "최근 생성순" },
] as const;
export type CatalogFilters = {
  q: string;
  category: string;
  region: string;
  theme: string;
  sort: (typeof catalogSorts)[number]["id"];
};
export const emptyCatalogFilters: CatalogFilters = {
  q: "",
  category: "",
  region: "",
  theme: "",
  sort: "default",
};
export function normalizeCatalogSearch(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
const compact = (value: string) =>
  normalizeCatalogSearch(value).replaceAll(" ", "");
const regionAliases: Record<string, string[]> = {
  서울: ["seoul"],
  도쿄: ["tokyo", "東京", "東京都"],
  한국: ["korea", "kr", "전국"],
  일본: ["japan", "jp", "日本"],
  부산: ["busan"],
  오사카: ["osaka", "大阪"],
};
export function buildCatalog(
  maps: ThemeMap[],
  summary: RegionSummary = {},
): CatalogMap[] {
  return maps
    .filter((map) => map.kind !== "creator")
    .map((map) => {
      const entry = catalogEditorial[map.slug];
      const city = entry?.region ?? regionName(map);
      const label =
        map.country === "KR" && city === "한국"
          ? "전국"
          : map.search_scope === "world"
            ? "세계"
            : city || formatLocation(map);
      const country =
        map.country === "KR"
          ? "한국"
          : map.country === "JP"
            ? "일본"
            : map.country;
      const regions = [
        ...new Set(
          [
            city,
            country,
            ...(summary[map.id] ?? []).map((area) => area.split(" · ")[0]),
          ].filter((v): v is string => Boolean(v) && v !== "기타 지역"),
        ),
      ];
      const categoryLabel =
        catalogCategories.find((c) => c.id === entry?.category)?.label ?? "";
      return {
        ...map,
        displayTitle: entry?.title ?? map.title,
        catalogCategory: entry?.category ?? null,
        categoryLabel,
        regionLabel: label,
        regions,
        searchTerms: [
          map.title,
          map.description,
          entry?.title ?? "",
          categoryLabel,
          ...map.tags,
          ...(entry?.aliases ?? []),
          ...regions,
          ...(summary[map.id] ?? []),
          ...regions.flatMap((r) => regionAliases[r] ?? []),
        ],
        editorialOrder: entry?.order ?? Number.MAX_SAFE_INTEGER,
        featured: entry?.featured === true && map.place_count > 0,
        featureReason: entry?.reason ?? "",
      };
    });
}
export function parseCatalogFilters(
  params: URLSearchParams,
  maps: CatalogMap[],
): CatalogFilters {
  const category = params.get("category") ?? "",
    region = params.get("region") ?? "",
    theme = params.get("theme") ?? "",
    sort = params.get("sort") ?? "default";
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    category: catalogCategories.some((c) => c.id === category) ? category : "",
    region: maps.some((m) => m.regions.includes(region)) ? region : "",
    theme:
      maps.some((m) => m.tags.includes(theme)) && theme !== "전체" ? theme : "",
    sort: catalogSorts.some((s) => s.id === sort)
      ? (sort as CatalogFilters["sort"])
      : "default",
  };
}
export function catalogHref(filters: Partial<CatalogFilters>) {
  const params = new URLSearchParams();
  for (const key of ["q", "category", "region", "theme", "sort"] as const) {
    const value = filters[key];
    if (value && !(key === "sort" && value === "default"))
      params.set(key, value);
  }
  return `/discover${params.size ? `?${params}` : ""}`;
}
export function filterCatalog(
  maps: CatalogMap[],
  filters: CatalogFilters,
): CatalogMap[] {
  const tokens = normalizeCatalogSearch(filters.q)
    .split(" ")
    .filter(Boolean)
    .map(compact);
  const rank = (map: CatalogMap) => {
    const title = compact(map.displayTitle),
      q = compact(filters.q);
    return title === q
      ? 0
      : title.startsWith(q)
        ? 1
        : title.includes(q)
          ? 2
          : 3;
  };
  return maps
    .filter(
      (map) =>
        (!filters.category || map.catalogCategory === filters.category) &&
        (!filters.region || map.regions.includes(filters.region)) &&
        (!filters.theme || map.tags.includes(filters.theme)) &&
        tokens.every((token) =>
          map.searchTerms.some((field) => compact(field).includes(token)),
        ),
    )
    .sort((a, b) => {
      let primary = 0;
      if (filters.sort === "popular")
        primary = (b.hype_week_count ?? 0) - (a.hype_week_count ?? 0);
      else if (filters.sort === "saved")
        primary =
          (b.saved_count ?? b.follower_count) -
          (a.saved_count ?? a.follower_count);
      else if (filters.sort === "newest")
        primary = b.created_at.localeCompare(a.created_at);
      else
        primary =
          (tokens.length ? rank(a) - rank(b) : 0) ||
          (filters.region
            ? Number(b.regions[0] === filters.region) -
              Number(a.regions[0] === filters.region)
            : 0);
      return (
        primary ||
        a.editorialOrder - b.editorialOrder ||
        a.slug.localeCompare(b.slug)
      );
    });
}
export function homeCatalog(maps: CatalogMap[]) {
  const ordered = filterCatalog(maps, emptyCatalogFilters);
  const featured = ordered.find((map) => map.featured);
  return {
    featured,
    items: ordered.filter((map) => map.id !== featured?.id).slice(0, 6),
  };
}
export function catalogLocation(map: CatalogMap, region = "") {
  return region && map.regions[0] !== region
    ? `${map.regionLabel} · ${region} 포함`
    : map.regionLabel;
}
