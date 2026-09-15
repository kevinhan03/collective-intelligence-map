import "server-only";
import { kakaoProvider } from "./providers/kakao";
import { overtureProvider } from "./providers/overture";
import { HttpError } from "@/server/http";
export function providerName(country: string): "kakao" | "overture" {
  return country.toUpperCase() === "KR" ? "kakao" : "overture";
}
export function routeProvider(country: string) {
  const name = providerName(country);
  if (name === "overture") return { name, adapter: overtureProvider };
  // KAKAO_LOCAL_API_KEY was the project's original variable name. Keep it
  // supported so existing deployments do not silently lose Korean search.
  const key = process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_LOCAL_API_KEY;
  if (process.env.KAKAO_PLACES_ENABLED !== "true" || !key)
    throw new HttpError(
      "장소 검색이 아직 열리지 않았습니다. 직접 장소를 등록할 수 있습니다.",
      503,
    );
  return { name, adapter: kakaoProvider(key) };
}
