import { boundsSchema } from "@/domain/validation";
import { getMaps, getPlaces } from "@/server/queries";
import { failure, HttpError, json } from "@/server/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const map = (await getMaps()).find((m) => m.id === id);
    if (!map) throw new HttpError("맵을 찾을 수 없습니다.", 404);
    const bounds = boundsSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const items = await getPlaces(map, bounds);
    return json({ items: items.slice(0, 500), truncated: items.length > 500 });
  } catch (e) {
    return failure(e);
  }
}
