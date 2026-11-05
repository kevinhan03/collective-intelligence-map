export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ko";
export const localeCookie = "lang";
export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);
export const intlLocale = (lang: Locale) => (lang === "en" ? "en-US" : "ko-KR");

// Routes outside app/[lang] keep a single unprefixed URL.
const unlocalized = /^\/(?:api|auth|go|_next)(?:[/?#]|$)/;

export function localePrefix(path: string): Locale | null {
  return (
    locales.find(
      (locale) =>
        path.startsWith(`/${locale}`) &&
        (path.length === locale.length + 1 ||
          "/?#".includes(path[locale.length + 1])),
    ) ?? null
  );
}

// Prefixes an internal path for the given locale; Korean stays unprefixed.
export function localizePath(path: string, lang: Locale) {
  if (
    lang === defaultLocale ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    unlocalized.test(path) ||
    localePrefix(path)
  )
    return path;
  return path === "/" || /^\/[?#]/.test(path)
    ? `/${lang}${path.slice(1)}`
    : `/${lang}${path}`;
}

// Removes a locale prefix so paths can be compared with the Korean routes.
export function stripLocale(path: string) {
  const locale = localePrefix(path);
  if (!locale) return path;
  const rest = path.slice(locale.length + 1);
  return rest.startsWith("/") ? rest : `/${rest}`;
}
