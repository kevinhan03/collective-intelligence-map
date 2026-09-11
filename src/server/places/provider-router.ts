import "server-only";
import { googleProvider } from "./providers/google";
import { kakaoProvider } from "./providers/kakao";
import { HttpError } from "@/server/http";
export function providerName(country: string): "google" | "kakao" {
  return country === "KR" ? "kakao" : "google";
}
export function routeProvider(country: string) {
  const provider = providerName(country);
  const key =
    provider === "kakao"
      ? process.env.KAKAO_LOCAL_API_KEY
      : process.env.GOOGLE_PLACES_API_KEY;
  const enabled =
    provider === "kakao"
      ? process.env.KAKAO_LOCAL_ENABLED
      : process.env.GOOGLE_PLACES_ENABLED;
  if (enabled !== "true" || !key) {
    console.error(
      JSON.stringify({
        type: "provider_gate_blocked",
        provider,
        enabledRaw: JSON.stringify(enabled),
        keyPresent: Boolean(key),
        keyLength: key?.length ?? 0,
      }),
    );
    throw new HttpError(
      "외부 장소 검색이 아직 열리지 않았습니다. 직접 알고 있는 장소를 제안할 수 있습니다.",
      503,
    );
  }
  return {
    name: provider,
    adapter: provider === "kakao" ? kakaoProvider(key) : googleProvider(key),
  };
}
