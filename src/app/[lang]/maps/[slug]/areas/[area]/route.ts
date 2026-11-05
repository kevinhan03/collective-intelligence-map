import { areaDocument, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; area: string }> },
) {
  try {
    const { slug, area } = await params;
    return await areaDocument(slug, area);
  } catch {
    return unavailablePage();
  }
}
