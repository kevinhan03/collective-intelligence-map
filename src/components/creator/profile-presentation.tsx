"use client";
import Link from "next/link";
import { Camera, ChevronRight, Pencil, Plus } from "lucide-react";
import { ShareButton } from "@/components/community/share-button";
import { ProfileCardImage } from "./profile-card-image";
import { profileCardTheme } from "@/domain/profile-image";
import { RecommendationCollectionCard } from "./profile-contributions";
import type { CreatorMap } from "@/domain/creator";

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
          <p className="profile-bio">{bio || "아직 소개가 없습니다."}</p>
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
                  <Pencil size={15} aria-hidden="true" /> 프로필 편집
                </span>
              </Link>
            </div>
          ) : (
            <ShareButton path={`/u/${handle}`} title={displayName || handle} />
          )}
        </div>
      </header>
      {
        <section className="profile-collection" aria-label="공개 장소 지도">
          <div className="profile-section-heading">
            <h2>
              내가 만든 지도 <span>{ordered.length}</span>
            </h2>
            {manageMapsHref && (
              <Link href={manageMapsHref} className="profile-maps-link">
                전체 보기 <ChevronRight size={14} />
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
                aria-label="첫 지도 만들기"
              >
                <ProfileCardImage theme="travel" />
                <div className="profile-map-copy">
                  <h3>지도를 만들어보세요</h3>
                  <p>좋아하는 장소를 모아 나만의 지도로 공유하세요.</p>
                  <span className="profile-create-label">
                    <Plus size={14} /> 첫 지도 만들기
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
                  <span className="profile-featured-label">대표 지도</span>
                )}
                <div className="profile-map-copy">
                  <h3>{map.title}</h3>
                  <p>
                    {map.city ||
                      (map.country === "KR"
                        ? "한국"
                        : map.country === "JP"
                          ? "일본"
                          : "세계")}{" "}
                    · {map.place_count}곳
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
            카드에서 지도·커버 편집 <ChevronRight size={14} />
          </Link>
        </section>
      }
    </div>
  );
}
