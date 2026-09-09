import "server-only";
import { z } from "zod";
import type { PlaceProvider } from "./types";
import { providerFetch } from "./types";
const response = z.object({
  documents: z.array(
    z.object({
      id: z.string(),
      place_name: z.string(),
      address_name: z.string(),
      x: z.string(),
      y: z.string(),
    }),
  ),
});
export function kakaoProvider(key: string): PlaceProvider {
  return {
    async search(query, { map }) {
      const params = new URLSearchParams({
        query,
        rect: `${map.bounds.west},${map.bounds.south},${map.bounds.east},${map.bounds.north}`,
        size: "8",
      });
      const result = response.parse(
        await providerFetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
          { headers: { Authorization: `KakaoAK ${key}` } },
        ),
      );
      return result.documents.map((d) => ({
        provider: "kakao",
        externalId: d.id,
        label: d.place_name,
        address: d.address_name,
        lng: Number(d.x),
        lat: Number(d.y),
        attribution: "Kakao Maps",
      }));
    },
    async details(candidate) {
      return candidate;
    },
  };
}
