import ko from "./dictionaries/ko.json";
import { intlLocale, type Locale } from "./config";
import { romanizePlace } from "./romanize";

export type Messages = typeof ko;
export type MessageKey = keyof Messages;
export type MessageValues = Record<string, string | number>;
export type Translate = ((
  key: MessageKey,
  values?: MessageValues,
) => string) & {
  // Labels that come from data (regions, categories): `${prefix}.${value}`, else
  // the value itself (region names are romanized outside Korean).
  data: (prefix: string, value: string) => string;
  // "서울 · 성동구"-style area labels, translated part by part.
  area: (value: string) => string;
  // A Korean runtime message (server errors, validation) matched against `server.*`.
  message: (value: string) => string;
};

// Korean `server.*` messages as matchers; `{name}` parts match any text.
const serverMessages = Object.entries(ko as Record<string, string>)
  .filter(([key]) => key.startsWith("server."))
  .map(([key, message]) => {
    const names = [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
    const source = message
      .split(/\{\w+\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(.+?)");
    return {
      key: key as MessageKey,
      names,
      pattern: new RegExp(`^${source}$`),
    };
  });

// `{name}` placeholders; a numeric `count` picks `key_one`/`key_other` when present.
export function createTranslator(
  lang: Locale,
  messages: Partial<Record<string, string>>,
): Translate {
  const plural = new Intl.PluralRules(intlLocale(lang));
  const number = new Intl.NumberFormat(intlLocale(lang));
  const t = ((key, values) => {
    let message = messages[key] ?? (ko as Record<string, string>)[key] ?? key;
    if (typeof values?.count === "number")
      message = messages[`${key}_${plural.select(values.count)}`] ?? message;
    if (!values) return message;
    return message.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name];
      if (value === undefined) return match;
      return typeof value === "number" ? number.format(value) : value;
    });
  }) as Translate;
  t.data = (prefix, value) =>
    messages[`${prefix}.${value}`] ??
    (ko as Record<string, string>)[`${prefix}.${value}`] ??
    (prefix === "region" && lang !== "ko" ? romanizePlace(value) : value);
  t.area = (value) =>
    value
      .split(" · ")
      .map((part) => t.data("region", part))
      .join(" · ");
  t.message = (value) => {
    if (lang === "ko") return value;
    for (const { key, names, pattern } of serverMessages) {
      const match = pattern.exec(value);
      if (match)
        return t(
          key,
          Object.fromEntries(
            names.map((name, i) => [name, t.message(match[i + 1])]),
          ),
        );
    }
    return value;
  };
  return t;
}
