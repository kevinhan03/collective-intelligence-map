import { defaultLocale, hasLocale } from "@/i18n/config";
import { directoryDocument, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; slug: string }> },
) {
  try {
    const { slug, lang } = await params;
    return await directoryDocument(slug, 1, locale(lang));
  } catch {
    return unavailablePage();
  }
}

function locale(lang: string) {
  return hasLocale(lang) ? lang : defaultLocale;
}
