import { areaDocument, missingPage, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; area: string; page: string }> },
) {
  try {
    const { slug, area, page } = await params;
    const number = Number(page);
    return number < 2 || String(number) !== page
      ? missingPage()
      : await areaDocument(slug, area, number);
  } catch {
    return unavailablePage();
  }
}
