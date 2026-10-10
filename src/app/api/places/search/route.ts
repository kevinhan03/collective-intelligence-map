import { searchSchema } from "@/domain/validation";
import { body, failure, json, requireViewer } from "@/server/http";
import { searchPlaces } from "@/server/places/search-service";
import { SearchTiming } from "@/server/places/search-timing";
export async function POST(request: Request) {
  const timing = new SearchTiming();
  let ok = false;
  try {
    const viewer = await timing.measure("auth", () => requireViewer());
    const result = await searchPlaces(
      searchSchema.parse(await body(request)),
      viewer,
      timing,
    );
    ok = true;
    return json(result);
  } catch (e) {
    return failure(e);
  } finally {
    timing.finish(ok);
  }
}
