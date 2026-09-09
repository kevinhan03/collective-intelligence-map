import { z } from "zod";
import { body, failure, json, requireViewer } from "@/server/http";
import { selectCandidate } from "@/server/places/search-service";
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const { token, mapId } = z
      .object({ token: z.string().max(3000), mapId: z.uuid() })
      .parse(await body(request));
    return json(await selectCandidate(token, mapId, viewer));
  } catch (e) {
    return failure(e);
  }
}
