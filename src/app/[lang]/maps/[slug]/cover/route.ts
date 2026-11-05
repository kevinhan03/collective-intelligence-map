import { publicDb } from "@/lib/supabase/public";
import { configured } from "@/lib/supabase/server";
import { GET as image } from "@/app/api/creator/maps/[id]/cover/route";
/** Public cover URL can be crawled; unlike the owner API it never serves a draft. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!configured()) return new Response(null, { status: 404 });
  const slug = (await params).slug;
  const { data, error } = await publicDb()
    .from("theme_maps")
    .select("id")
    .eq("slug", slug)
    .eq("kind", "creator")
    .eq("status", "published")
    .maybeSingle();
  if (error || !data)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return image(request, { params: Promise.resolve({ id: data.id }) });
}
