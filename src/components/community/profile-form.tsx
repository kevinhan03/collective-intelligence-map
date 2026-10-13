"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { post } from "./api";
import {
  creatorCommandSchema,
  normalizeInstagramProfile,
  type CreatorSnapshot,
} from "@/domain/creator";
import { ProfilePresentation } from "@/components/creator/profile-presentation";
import type { Viewer } from "@/domain/types";
export function ProfileForm({
  viewer,
  snapshot = null,
  recommendationCount = 0,
  contributionError = "",
  editing = false,
}: {
  viewer: Viewer;
  snapshot?: CreatorSnapshot | null;
  recommendationCount?: number;
  contributionError?: string;
  editing?: boolean;
}) {
  const [handle, setHandle] = useState(viewer.handle),
    [bio, setBio] = useState(viewer.bio);
  const [displayName, setDisplayName] = useState(
    snapshot?.profile?.display_name || "",
  );
  const [instagram, setInstagram] = useState(
    snapshot?.profile?.instagram || "",
  );
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [savedHandle, setSavedHandle] = useState(viewer.handle);
  const submitting = useRef(false);
  const router = useRouter();
  const publicMaps =
    snapshot?.maps.filter((m) => m.status === "published" && !m.hidden_at) ||
    [];
  const normalizedInstagram = normalizeInstagramProfile(instagram);
  const preview = (
    <>
      <ProfilePresentation
        handle={handle}
        displayName={displayName}
        bio={bio}
        instagram={
          /^https:\/\/www\.instagram\.com\/[A-Za-z0-9_.]{1,30}\/$/.test(
            normalizedInstagram,
          )
            ? normalizedInstagram
            : ""
        }
        maps={publicMaps}
        featuredId={snapshot?.profile?.featured_map_id}
        preview
        recommendationCount={recommendationCount}
        recommendationError={contributionError}
        collectionHandle={savedHandle}
      />
    </>
  );
  if (!editing)
    return (
      <section className="profile-settings-overview" aria-label="프로필">
        <header className="profile-overview-heading">
          <h1>프로필</h1>
        </header>
        <ProfilePresentation
          handle={savedHandle}
          headingLevel="h2"
          displayName={displayName}
          bio={bio}
          instagram={
            /^https:\/\/www\.instagram\.com\/[A-Za-z0-9_.]{1,30}\/$/.test(
              normalizedInstagram,
            )
              ? normalizedInstagram
              : ""
          }
          maps={publicMaps}
          featuredId={snapshot?.profile?.featured_map_id}
          recommendationCount={recommendationCount}
          recommendationError={contributionError}
          collectionHandle={savedHandle}
          manageMapsHref="/studio"
          editProfileHref="/settings/profile?edit=1"
        />
        <nav className="profile-account-links profile-overview-links">
          <Link href="/studio">내 지도 관리</Link>
          <Link href="/my-proposals">내 제안 보기</Link>
        </nav>
      </section>
    );
  return (
    <div className="profile-editor-grid">
      <form
        className="profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting.current) return;
          const payload = creatorCommandSchema.safeParse({
            action: "profile",
            displayName,
            bio,
            instagram,
            featuredMapId: snapshot?.profile?.featured_map_id || "",
          });
          if (snapshot && !payload.success) {
            setMessage(payload.error.issues[0].message);
            return;
          }
          submitting.current = true;
          setBusy(true);
          setMessage("");
          let baseSaved = false;
          try {
            await post("/api/community", {
              action: "profile",
              handle,
              bio,
              avatar_path: viewer.avatar_path,
            });
            baseSaved = true;
            setSavedHandle(handle);
            if (snapshot && payload.success)
              await post("/api/creator/maps", payload.data);
            setMessage("프로필을 저장했습니다.");
            router.refresh();
          } catch (error) {
            setMessage(
              (baseSaved
                ? "사용자 이름·소개는 저장됐습니다. 표시 이름·Instagram 저장 실패: "
                : "") + (error as Error).message,
            );
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        <div className="profile-editor-heading">
          <Link href="/settings/profile" className="profile-edit-back">
            <ArrowLeft size={15} /> 프로필로 돌아가기
          </Link>
          <h1>프로필 편집</h1>
          <p>나의 취향이 담긴 장소를 더 많은 사람들과 공유해 보세요.</p>
        </div>
        <fieldset disabled={busy} className="profile-fields">
          <div className="profile-name-fields">
            <label>
              표시 이름
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                disabled={!snapshot}
              />
            </label>
            <label>
              사용자 이름
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                pattern="[a-zA-Z0-9_]{3,30}"
                required
              />
              <span className="profile-help">영문·숫자·밑줄, 3–30자</span>
            </label>
          </div>
          <label>
            소개
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder="어떤 장소와 주제에 관심이 있나요?"
            />
            <span className="profile-character-count">{bio.length}/500</span>
          </label>
          <label>
            Instagram <span className="profile-help">(선택)</span>
            <Input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              type="url"
              placeholder="https://www.instagram.com/username/"
              disabled={!snapshot}
            />
          </label>
          {!snapshot && (
            <p className="profile-help">
              표시 이름과 Instagram 편집은 크리에이터 기능 준비 후 사용할 수
              있습니다.
            </p>
          )}
          <div>
            <p className="profile-field-label">프로필 URL</p>
            <div className="profile-url-row">
              <span>/u/{handle}</span>
              <button
                type="button"
                className="profile-action"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      new URL("/u/" + handle, window.location.origin).href,
                    );
                    setMessage(
                      "링크를 복사했습니다. 변경한 사용자 이름은 저장 후 적용됩니다.",
                    );
                  } catch {
                    setMessage("링크를 복사하지 못했습니다.");
                  }
                }}
              >
                <span>
                  <Copy size={15} /> 링크 복사
                </span>
              </button>
            </div>
          </div>
        </fieldset>
        <div className="profile-save-row">
          <button className="profile-action profile-primary" disabled={busy}>
            <span>{busy ? "저장 중" : "변경사항 저장"}</span>
          </button>
          <Link href={"/u/" + savedHandle} className="profile-action">
            <span>
              <ExternalLink size={15} /> 공개 프로필 보기
            </span>
          </Link>
        </div>
        {message && (
          <p role="status" className="profile-feedback">
            {message}
          </p>
        )}
        <nav className="profile-account-links">
          <Link href="/studio">내 지도 관리</Link>
          <Link href="/my-proposals">내 제안 보기</Link>
        </nav>
      </form>
      <aside className="profile-desktop-preview">
        <h2>공개 프로필 미리보기</h2>
        <p className="profile-help">
          입력한 내용이 공개 화면에 이렇게 표시됩니다.
        </p>
        <div className="profile-preview-content">{preview}</div>
      </aside>
    </div>
  );
}
