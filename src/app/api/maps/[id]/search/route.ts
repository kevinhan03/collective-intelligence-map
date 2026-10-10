import { z } from "zod";
import { mapSearchInput } from "@/domain/map-search";
import { getMaps } from "@/server/queries";
import { searchMapPlaces } from "@/server/map-search";
import { failure, HttpError, json } from "@/server/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    if (!(await getMaps()).some((map) => map.id === id))
      throw new HttpError("공개 지도를 찾을 수 없습니다.", 404);
    const input = mapSearchInput.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return json(await searchMapPlaces(id, input));
  } catch (error) {
    return failure(error);
  }
}
