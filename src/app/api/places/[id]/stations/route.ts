import { z } from "zod";
import { getNearbyStations } from "@/server/stations";
import { failure, json } from "@/server/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id);
    return json(await getNearbyStations(id));
  } catch (error) {
    return failure(error);
  }
}
