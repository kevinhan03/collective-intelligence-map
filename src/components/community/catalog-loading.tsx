"use client";
import { useI18n } from "@/i18n/client";
export function CatalogLoading() {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("home.loadingMaps")} className="py-6">
      <span className="sr-only">{t("home.loadingMapsMessage")}</span>
      <div aria-hidden="true" className="h-13 rounded-full bg-white/5" />
      <div aria-hidden="true" className="mt-7 h-52 rounded-3xl bg-white/5" />
    </div>
  );
}
