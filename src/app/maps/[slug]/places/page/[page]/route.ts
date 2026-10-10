import { directoryDocument, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; page: string }> },
) {
  try {
    const { slug, page } = await params;
    return await directoryDocument(slug, Number(page));
  } catch {
    return unavailablePage();
  }
}
