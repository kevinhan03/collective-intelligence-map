import "server-only";
import { googleProvider } from "./providers/google";
import { HttpError } from "@/server/http";
/**
 * Google is the single resolver for every Theme Map.
 *
 * The internal Place ID remains provider-independent, so the dormant Kakao
 * adapter can be reconsidered without changing community data.
 */
export function providerName(country: string): "google" {
  void country;
  return "google";
}
export function routeProvider(country: string) {
  const provider = providerName(country);
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const enabled = process.env.GOOGLE_PLACES_ENABLED;
  if (enabled !== "true" || !key)
    throw new HttpError(
      "외부 장소 검색이 아직 열리지 않았습니다. 직접 알고 있는 장소를 제안할 수 있습니다.",
      503,
    );
  return {
    name: provider,
    adapter: googleProvider(key),
  };
}
