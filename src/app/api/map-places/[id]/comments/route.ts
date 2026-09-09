import { z } from "zod";
import { getComments } from "@/server/queries";
import { failure, json } from "@/server/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return json({ comments: await getComments(z.uuid().parse(id)) });
  } catch (e) {
    return failure(e);
  }
}
