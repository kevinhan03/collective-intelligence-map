import { placeCity } from "./place-location";
import type { ThemeMap } from "./types";

export const MIN_AREA_PLACES = 3;
export type SeoArea = {
  key: string;
  label: string;
  city: string;
  district: string;
  placeIds: string[];
};
type LocatedPlace = { place_id: string; address: string };

// Only explicit address names are mapped. Do not infer a district from a map
// title or coordinates, or change the existing interactive/SQL search rules.
const seoulDistricts: Record<string, string> = {
  Yongsan: "용산구",
  Mapo: "마포구",
  Seongdong: "성동구",
  Gangnam: "강남구",
  Jongno: "종로구",
  Jung: "중구",
  Jungnang: "중랑구",
  Seodaemun: "서대문구",
  Seocho: "서초구",
  Songpa: "송파구",
  Gangdong: "강동구",
  Gangseo: "강서구",
  Gangbuk: "강북구",
  Gwanak: "관악구",
  Gwangjin: "광진구",
  Dongdaemun: "동대문구",
  Dobong: "도봉구",
  Nowon: "노원구",
  Eunpyeong: "은평구",
  Seongbuk: "성북구",
  Dongjak: "동작구",
  Yangcheon: "양천구",
  Yeongdeungpo: "영등포구",
  Guro: "구로구",
  Geumcheon: "금천구",
};

export function addressRegion(address: string) {
  const city = placeCity(address);
  if (city === "기타 지역") return null;
  // Administrative units such as 중구 have only one syllable before 구.
  let district =
    address.match(/(?:^|[\s,·])([가-힣]{1,8}(?:구|군))(?=[\s,·]|$)/)?.[1] ?? "";
  if (!district && city === "서울") {
    district =
      Object.entries(seoulDistricts).find(([name]) =>
        new RegExp(`\\b${name}(?:-gu|\\s+(?:District|gu))\\b`, "i").test(
          address,
        ),
      )?.[1] ?? "";
  }
  return { city, district };
}

export function seoAreas(places: LocatedPlace[]): SeoArea[] {
  const unique = [...new Map(places.map((p) => [p.place_id, p])).values()];
  const groups = new Map<string, SeoArea>();
  for (const place of unique) {
    const region = addressRegion(place.address);
    if (!region) continue;
    for (const district of [
      "",
      ...(region.district ? [region.district] : []),
    ]) {
      const key = [region.city, district].filter(Boolean).join("-");
      if (!groups.has(key))
        groups.set(key, {
          key,
          label: [region.city, district].filter(Boolean).join(" "),
          city: region.city,
          district,
          placeIds: [],
        });
      groups.get(key)!.placeIds.push(place.place_id);
    }
  }
  const signatures = new Set<string>();
  // Prefer the more precise group when city and district contain the same set.
  return [...groups.values()]
    .filter(
      (g) =>
        g.placeIds.length >= MIN_AREA_PLACES &&
        g.placeIds.length < unique.length,
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.district)) - Number(Boolean(a.district)) ||
        a.key.localeCompare(b.key, "ko"),
    )
    .filter((g) => {
      const signature = [...g.placeIds].sort().join(",");
      if (signatures.has(signature)) return false;
      signatures.add(signature);
      return true;
    })
    .sort(
      (a, b) =>
        b.placeIds.length - a.placeIds.length ||
        a.label.localeCompare(b.label, "ko"),
    );
}

export function areaPath(slug: string, key: string, page = 1) {
  return `/maps/${encodeURIComponent(slug)}/areas/${encodeURIComponent(key)}${page > 1 ? `/page/${page}` : ""}`;
}
export function areaTitle(map: ThemeMap, area: SeoArea) {
  const theme = map.tags.find((tag) => tag && tag !== "전체") ?? map.title;
  return `${area.label} ${theme} 추천 장소`;
}
