import { defaultLocale, hasLocale } from "@/i18n/config";
import { areaDocument, missingPage, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ lang: string; slug: string; area: string; page: string }>;
  },
) {
  try {
    const { slug, area, page, lang } = await params;
    const number = Number(page);
    return number < 2 || String(number) !== page
      ? missingPage(locale(lang))
      : await areaDocument(slug, area, number, locale(lang));
  } catch {
    return unavailablePage();
  }
}

function locale(lang: string) {
  return hasLocale(lang) ? lang : defaultLocale;
}
