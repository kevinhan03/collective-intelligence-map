import type { Locale } from "./config";
import type { Messages } from "./translate";

const dictionaries: Record<Locale, () => Promise<Partial<Messages>>> = {
  ko: () => import("./dictionaries/ko.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
};

export const getMessages = (lang: Locale) => dictionaries[lang]();
