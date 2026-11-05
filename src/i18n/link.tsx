"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localizePath } from "./config";
import { useI18n } from "./client";

// Drop-in next/link that keeps the visitor's language on internal paths.
export default function Link({
  href,
  ...props
}: ComponentProps<typeof NextLink>) {
  const { lang } = useI18n();
  const localized =
    typeof href === "string"
      ? localizePath(href, lang)
      : href.pathname
        ? { ...href, pathname: localizePath(href.pathname, lang) }
        : href;
  return <NextLink href={localized} {...props} />;
}
