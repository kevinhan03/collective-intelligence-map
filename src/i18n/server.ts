import { lang } from "next/root-params";
import { redirect as nextRedirect } from "next/navigation";
import { defaultLocale, hasLocale, localizePath, type Locale } from "./config";
import { getMessages } from "./dictionaries";
import { createTranslator } from "./translate";

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return value && hasLocale(value) ? value : defaultLocale;
}

export async function getTranslator() {
  const locale = await getLocale();
  return createTranslator(locale, await getMessages(locale));
}

export async function localizedPath(path: string) {
  return localizePath(path, await getLocale());
}

export async function redirect(path: string): Promise<never> {
  nextRedirect(await localizedPath(path));
}
