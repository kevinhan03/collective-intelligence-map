import { describe, expect, it } from "vitest";
import { localePrefix, localizePath, stripLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/translate";
import { romanizePlace } from "@/i18n/romanize";
import ko from "@/i18n/dictionaries/ko.json";
import en from "@/i18n/dictionaries/en.json";

describe("locale paths", () => {
  it("prefixes English paths and keeps Korean unprefixed", () => {
    expect(localizePath("/maps/a?x=1", "en")).toBe("/en/maps/a?x=1");
    expect(localizePath("/", "en")).toBe("/en");
    expect(localizePath("/?q=1", "en")).toBe("/en?q=1");
    expect(localizePath("/maps/a", "ko")).toBe("/maps/a");
  });
  it("leaves external, API and already prefixed paths alone", () => {
    expect(localizePath("/api/community", "en")).toBe("/api/community");
    expect(localizePath("/auth/signout", "en")).toBe("/auth/signout");
    expect(localizePath("https://example.com", "en")).toBe(
      "https://example.com",
    );
    expect(localizePath("//example.com", "en")).toBe("//example.com");
    expect(localizePath("/en/maps/a", "en")).toBe("/en/maps/a");
  });
  it("strips only real locale segments", () => {
    expect(stripLocale("/en/maps/a")).toBe("/maps/a");
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/entries")).toBe("/entries");
    expect(localePrefix("/english")).toBeNull();
  });
});

describe("translator", () => {
  it("fills placeholders and picks plural forms", () => {
    const t = createTranslator("en", en);
    expect(t("map.placeCount", { count: 1 })).toBe("1 place");
    expect(t("map.placeCount", { count: 1200 })).toBe("1,200 places");
    expect(t("map.creatorMap", { handle: "ting" })).toBe("Map by @ting");
  });
  it("falls back to Korean, then to romanized region names", () => {
    const t = createTranslator("en", {});
    expect(t("nav.saved")).toBe(ko["nav.saved"]);
    expect(createTranslator("en", en).area("서울 · 성수동")).toBe(
      "Seoul · Seongsu-dong",
    );
    expect(createTranslator("ko", ko).area("서울 · 성수동")).toBe(
      "서울 · 성수동",
    );
  });
});

it("every Korean message has an English translation", () => {
  const missing = Object.keys(ko).filter((key) => !(key in en));
  expect(missing).toEqual([]);
});

it("English messages keep the Korean placeholders", () => {
  const names = (message: string) =>
    [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const english = en as Record<string, string>;
  for (const [key, message] of Object.entries(ko as Record<string, string>))
    expect(names(english[key] ?? message), key).toEqual(names(message));
});

it("romanizes Korean place names", () => {
  expect(
    ["성수동", "종로구", "전라남도", "강원특별자치도"].map(romanizePlace),
  ).toEqual(["Seongsu-dong", "Jongno-gu", "Jeollanam-do", "Gangwon-do"]);
});

it("translates Korean runtime messages, including nested parts", () => {
  const t = createTranslator("en", en);
  expect(t.message("로그인이 필요합니다.")).toBe(
    en["server.pleaseSignInToContinue"],
  );
  expect(
    t.message(
      "외부 장소 검색을 잠시 쉬어 갈게요. 약 5분 뒤 다시 검색할 수 있어요. 그동안 이미 등록된 장소에서 고르거나 직접 등록할 수 있어요.",
    ),
  ).toContain("in about 5 min");
  expect(t.message("처음 보는 문장")).toBe("처음 보는 문장");
  expect(createTranslator("ko", ko).message("로그인이 필요합니다.")).toBe(
    "로그인이 필요합니다.",
  );
});
