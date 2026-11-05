import { photoPreviewInputSchema } from "@/domain/place-photo";
import { getPhotoPreviews } from "@/server/place-photos";
import { body, failure, json } from "@/server/http";

export async function POST(request: Request) {
  try {
    const { placeIds } = photoPreviewInputSchema.parse(await body(request));
    return json({ previews: await getPhotoPreviews([...new Set(placeIds)]) });
  } catch (error) {
    return failure(error);
  }
}
