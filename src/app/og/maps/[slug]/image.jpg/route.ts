import { getMap } from "@/server/queries";
import { mapShareCard } from "@/server/share-images";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const map = slug.length <= 200 ? await getMap(slug) : null;
    if (!map)
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const image = await mapShareCard(map);
    const headers = {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-cache",
      ETag: image.etag,
      "X-Content-Type-Options": "nosniff",
    };
    if (request.headers.get("if-none-match") === image.etag)
      return new Response(null, { status: 304, headers });
    return new Response(image.bytes, { headers });
  } catch {
    console.error("map_share_card_unavailable");
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
