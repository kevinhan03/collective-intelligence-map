"use client";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { localeCookie, localizePath } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { usePathname } from "@/i18n/navigation";

export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const next = lang === "en" ? "ko" : "en";
  const href = localizePath(`${pathname}${search ? `?${search}` : ""}`, next);
  return (
    <NextLink
      href={href}
      prefetch={false}
      hrefLang={next}
      lang={next}
      className={className}
      aria-label={t("lang.switchLabel")}
      onClick={() => {
        document.cookie = `${localeCookie}=${next}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <Languages size={16} aria-hidden="true" />
      <span>{t("lang.switchShort")}</span>
    </NextLink>
  );
}
