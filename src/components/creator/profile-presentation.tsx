"use client";
import Link from "@/i18n/link";
import { Camera, ChevronRight, Pencil, Plus } from "lucide-react";
import { ShareButton } from "@/components/community/share-button";
import { ProfileCardImage } from "./profile-card-image";
import { profileCardTheme } from "@/domain/profile-image";
import { RecommendationCollectionCard } from "./profile-contributions";
import type { CreatorMap } from "@/domain/creator";

import { useI18n } from "@/i18n/client";
export type ProfilePresentationProps = {
  handle: string;
  displayName?: string;
  bio: string;
  instagram?: string;
  maps: CreatorMap[];
  featuredId?: string | null;
  preview?: boolean;
  recommendationCount?: number;
  recommendationError?: string;
  collectionHandle?: string;
  headingLevel?: "h1" | "h2";
  manageMapsHref?: string;
  editProfileHref?: string;
};
export function ProfilePresentation({
  handle,
  displayName,
  bio,
  instagram,
  maps,
  featuredId,
  preview,
  recommendationCount = 0,
  recommendationError,
  collectionHandle,
  headingLevel,
  manageMapsHref,
  editProfileHref,
}: ProfilePresentationProps) {
  const { t } = useI18n();
  const ordered = [...maps].sort(
    (a, b) => Number(b.id === featuredId) - Number(a.id === featuredId),
  );
  const NameHeading = headingLevel ?? (preview ? "h2" : "h1");
  return (
    <div className={`profile-presentation ${preview ? "is-preview" : ""}`}>
      <header className="profile-identity">
        <div className="min-w-0">
          <NameHeading className="profile-display-name">
            {displayName || handle}
          </NameHeading>
          <p className="profile-handle">@{handle}</p>
          <p className="profile-bio">{bio || t("creator.noBioYet")}</p>
        </div>
        <div
          className={`profile-socials${editProfileHref ? " has-owner-actions" : ""}`}
        >
          {instagram && (
            <a
              className="profile-action"
              href={instagram}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <Camera size={15} /> Instagram
              </span>
            </a>
          )}
          {editProfileHref ? (
            <div className="profile-owner-actions">
              <ShareButton
                path={`/u/${handle}`}
                title={displayName || handle}
              />
              <Link href={editProfileHref} className="profile-action">
                <span>
                  <Pencil size={15} aria-hidden="true" />{" "}
                  {t("creator.editProfile")}
                </span>
              </Link>
            </div>
          ) : (
            <ShareButton path={`/u/${handle}`} title={displayName || handle} />
          )}
        </div>
      </header>
      {
        <section
          className="profile-collection"
          aria-label={t("creator.publicPlacesMap")}
        >
          <div className="profile-section-heading">
            <h2>
              {t("creator.mapsIMade")} <span>{ordered.length}</span>
            </h2>
            {manageMapsHref && (
              <Link href={manageMapsHref} className="profile-maps-link">
                {t("creator.seeAll")} <ChevronRight size={14} />
              </Link>
            )}
          </div>
          <div className="profile-map-grid">
            <RecommendationCollectionCard
              handle={collectionHandle || handle}
              count={recommendationCount}
              error={recommendationError}
            />
            {!ordered.length && (
              <Link
                href="/studio"
                className="profile-map profile-map-featured profile-map-empty"
                aria-label={t("creator.createYourFirstMap")}
              >
                <ProfileCardImage theme="travel" />
                <div className="profile-map-copy">
                  <h3>{t("creator.createAMap")}</h3>
                  <p>{t("creator.collectYourFavoritePlacesAnd")}</p>
                  <span className="profile-create-label">
                    <Plus size={14} /> {t("creator.createYourFirstMap")}
                  </span>
                </div>
              </Link>
            )}
            {ordered.map((map) => (
              <Link
                key={map.id}
                href={
                  preview || editProfileHref
                    ? `/studio?map=${map.id}`
                    : `/maps/${map.slug}`
                }
                className="profile-map"
                data-immersive={
                  map.id === featuredId && map.cover_path ? "" : undefined
                }
              >
                <ProfileCardImage
                  src={map.cover_path ? `/maps/${map.slug}/cover` : null}
                  theme={profileCardTheme(
                    [map.title, map.description, ...map.tags].join(" "),
                  )}
                />
                {map.id === featuredId && (
                  <span className="profile-featured-label">
                    {t("creator.featuredMap")}
                  </span>
                )}
                <div className="profile-map-copy">
                  <h3>{map.title}</h3>
                  <p>
                    {map.city ||
                      (map.country === "KR"
                        ? t("creator.korea")
                        : map.country === "JP"
                          ? t("creator.japan")
                          : t("creator.worldwide"))}{" "}
                    · {t("creator.placeCount", { count: map.place_count })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            href="/studio"
            className="profile-manage-link"
            hidden={!(preview || editProfileHref) || !ordered.length}
          >
            {t("creator.editMapsAndCoversFrom")} <ChevronRight size={14} />
          </Link>
        </section>
      }
    </div>
  );
}
