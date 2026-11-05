"use client";
import { useMemo } from "react";
import {
  usePathname as useNextPathname,
  useRouter as useNextRouter,
} from "next/navigation";
import { localizePath, stripLocale } from "./config";
import { useI18n } from "./client";

// Pathname without the locale prefix, matching the Korean route paths.
export function usePathname() {
  return stripLocale(useNextPathname());
}

export function useRouter() {
  const router = useNextRouter();
  const { lang } = useI18n();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(localizePath(href, lang), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(localizePath(href, lang), options),
      prefetch: (
        href: string,
        options?: Parameters<typeof router.prefetch>[1],
      ) => router.prefetch(localizePath(href, lang), options),
    }),
    [router, lang],
  );
}
