import { searchSchema } from "@/domain/validation";
import { body, failure, json, requireViewer } from "@/server/http";
import { searchPlaces } from "@/server/places/search-service";
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    return json(
      await searchPlaces(searchSchema.parse(await body(request)), viewer),
    );
  } catch (e) {
    return failure(e);
  }
}
