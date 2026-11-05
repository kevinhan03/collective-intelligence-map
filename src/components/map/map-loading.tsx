"use client";
import { MapPin } from "lucide-react";

import { useI18n } from "@/i18n/client";
export function MapLoading() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="map-grid flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <MapPin className="text-primary" size={28} aria-hidden="true" />
      <p className="text-sm font-medium">{t("map.gettingTheMapReady")}</p>
      <p className="max-w-xs text-xs leading-5 text-muted-foreground">
        {t("map.youCanSeePlaceDetails")}
      </p>
    </div>
  );
}
