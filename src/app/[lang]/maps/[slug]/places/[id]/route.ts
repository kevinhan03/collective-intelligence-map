import { defaultLocale, hasLocale } from "@/i18n/config";
import { placeDocument, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; slug: string; id: string }> },
) {
  try {
    const { slug, id, lang } = await params;
    return await placeDocument(slug, id, locale(lang));
  } catch {
    return unavailablePage();
  }
}

function locale(lang: string) {
  return hasLocale(lang) ? lang : defaultLocale;
}
