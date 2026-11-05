import { defaultLocale, hasLocale } from "@/i18n/config";
import { areaDocument, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; slug: string; area: string }> },
) {
  try {
    const { slug, area, lang } = await params;
    return await areaDocument(slug, area, 1, locale(lang));
  } catch {
    return unavailablePage();
  }
}

function locale(lang: string) {
  return hasLocale(lang) ? lang : defaultLocale;
}
