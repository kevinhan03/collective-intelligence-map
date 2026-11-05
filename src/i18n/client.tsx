"use client";
import { createContext, useContext, useMemo } from "react";
import { defaultLocale, localizePath, type Locale } from "./config";
import { createTranslator, type Messages } from "./translate";

const I18nContext = createContext({
  lang: defaultLocale as Locale,
  t: createTranslator(defaultLocale, {}),
});

export function I18nProvider({
  lang,
  messages,
  children,
}: {
  lang: Locale;
  messages: Partial<Messages>;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ lang, t: createTranslator(lang, messages) }),
    [lang, messages],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const { lang, t } = useContext(I18nContext);
  return { lang, t, href: (path: string) => localizePath(path, lang) };
}
