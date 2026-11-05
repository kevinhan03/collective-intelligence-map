"use client";
import Link from "@/i18n/link";
import { MapPin } from "lucide-react";
import { ProfileCardImage } from "./profile-card-image";
import { useI18n } from "@/i18n/client";
export function RecommendationCollectionCard({
  handle,
  count,
  error,
}: {
  handle: string;
  count: number;
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <Link
      href={`/u/${encodeURIComponent(handle)}/recommendations`}
      className="profile-map profile-map-featured profile-recommendations-card"
      aria-label={t("creator.placesIRecommended")}
    >
      <ProfileCardImage theme="food" />
      <div className="profile-map-copy">
        <h3>{t("creator.placesIRecommended")}</h3>
        <p>
          <MapPin size={12} aria-hidden="true" />
          {error
            ? t("creator.pleaseReopen")
            : t("creator.publicPlacesListAndMap", { count })}
        </p>
      </div>
    </Link>
  );
}
