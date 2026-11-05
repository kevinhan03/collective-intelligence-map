import type { Metadata } from "next";
import { defaultLocale, localizePath, locales, type Locale } from "./config";

// Locales search engines may index. English stays out until its review is done;
// add "en" here to publish its hreflang links and sitemap entries.
export const indexedLocales: readonly Locale[] = ["ko"];

export function localeAlternates(
  path: string,
  lang: Locale,
): Metadata["alternates"] {
  const indexed = locales.filter((locale) => indexedLocales.includes(locale));
  return {
    canonical: localizePath(path, lang),
    languages:
      indexed.length > 1
        ? {
            ...Object.fromEntries(
              indexed.map((locale) => [locale, localizePath(path, locale)]),
            ),
            "x-default": localizePath(path, defaultLocale),
          }
        : undefined,
  };
}
