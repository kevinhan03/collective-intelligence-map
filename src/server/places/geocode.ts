import "server-only";
import { z } from "zod";
import type { ThemeMap } from "@/domain/types";
import { HttpError } from "@/server/http";

const responseSchema = z.object({
  features: z.array(
    z.object({
      center: z.tuple([z.number(), z.number()]),
      place_name: z.string().optional(),
      text: z.string().optional(),
    }),
  ),
});

function mapTilerKey() {
  const style = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL;
  if (!style) return null;
  try {
    return new URL(style).searchParams.get("key");
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string, map: ThemeMap) {
  const key = mapTilerKey();
  if (!key)
    throw new HttpError("주소에서 위치를 찾을 수 있도록 지도 연결을 준비 중입니다.", 503);
  const url = new URL(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json`,
  );
  url.searchParams.set("key", key);
  url.searchParams.set("country", map.country.toLowerCase());
  url.searchParams.set(
    "bbox",
    [map.bounds.west, map.bounds.south, map.bounds.east, map.bounds.north].join(","),
  );
  url.searchParams.set("limit", "1");
  url.searchParams.set("fuzzyMatch", "false");
  url.searchParams.set("language", map.country === "JP" ? "ja" : "ko");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://collective-intelligence-map.vercel.app";
  const origin = new URL(site).origin;
  const result = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
    headers: { Origin: origin, Referer: `${origin}/` },
  });
  if (!result.ok)
    throw new HttpError("주소에서 위치를 찾지 못했습니다. 주소를 더 자세히 입력해 주세요.", 422);
  const feature = responseSchema.parse(await result.json()).features[0];
  if (!feature)
    throw new HttpError("이 지도 범위 안에서 주소를 찾지 못했습니다.", 422);
  const [lng, lat] = feature.center;
  if (
    lng < map.bounds.west ||
    lng > map.bounds.east ||
    lat < map.bounds.south ||
    lat > map.bounds.north
  )
    throw new HttpError("이 지도 범위 안의 주소를 입력해 주세요.", 422);
  return { lat, lng, label: feature.place_name ?? feature.text ?? address };
}
