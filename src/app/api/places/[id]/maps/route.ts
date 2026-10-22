import { z } from "zod";
import { getPlaceMaps } from "@/server/place-maps";
import { failure, json } from "@/server/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    return json({ maps: await getPlaceMaps(id) });
  } catch (error) {
    return failure(error);
  }
}
