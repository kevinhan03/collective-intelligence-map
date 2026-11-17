import "server-only";
import { canRegisterPlaces } from "@/domain/place-registration";
import type { ThemeMap, Viewer } from "@/domain/types";
import { HttpError } from "@/server/http";

export function requirePlaceRegistration(
  map: Pick<ThemeMap, "country" | "search_scope">,
  viewer: Pick<Viewer, "role">,
) {
  if (!canRegisterPlaces(map, viewer))
    throw new HttpError(
      "해외 지도에는 관리자만 장소를 등록할 수 있습니다.",
      403,
    );
}
