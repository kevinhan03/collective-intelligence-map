import { homeShareCard } from "@/server/share-images";
export async function GET() {
  try {
    const image = await homeShareCard();
    return new Response(image.bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        ETag: image.etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("home_share_card_unavailable");
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
