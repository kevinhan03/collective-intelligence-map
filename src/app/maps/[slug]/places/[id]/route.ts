import { placeDocument, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
    return await placeDocument(slug, id);
  } catch {
    return unavailablePage();
  }
}
