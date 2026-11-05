"use client";
import { useRef, useState } from "react";
import Link from "@/i18n/link";
import { useRouter } from "@/i18n/navigation";
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
import { useI18n } from "@/i18n/client";
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
  const { t } = useI18n();
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
      <section
        className="profile-settings-overview"
        aria-label={t("profile.profile")}
      >
        <header className="profile-overview-heading">
          <h1>{t("profile.profile")}</h1>
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
          <Link href="/studio">{t("profile.manageMyMaps")}</Link>
          <Link href="/my-proposals">{t("profile.viewMySuggestions")}</Link>
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
            setMessage(t.message(payload.error.issues[0].message));
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
            setMessage(t("profile.profileSaved"));
            router.refresh();
          } catch (error) {
            setMessage(
              (baseSaved ? t("profile.yourUsernameAndBioWere") : "") +
                t.message((error as Error).message),
            );
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        <div className="profile-editor-heading">
          <Link href="/settings/profile" className="profile-edit-back">
            <ArrowLeft size={15} /> {t("profile.backToProfile")}
          </Link>
          <h1>{t("profile.editProfile")}</h1>
          <p>{t("profile.shareThePlacesThatReflect")}</p>
        </div>
        <fieldset disabled={busy} className="profile-fields">
          <div className="profile-name-fields">
            <label>
              {t("profile.displayName")}
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                disabled={!snapshot}
              />
            </label>
            <label>
              {t("profile.username")}
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                pattern="[a-zA-Z0-9_]{3,30}"
                required
              />
              <span className="profile-help">
                {t("profile.lettersNumbersAndUnderscores3")}
              </span>
            </label>
          </div>
          <label>
            {t("profile.bio")}
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder={t("profile.whatKindsOfPlacesAnd")}
            />
            <span className="profile-character-count">{bio.length}/500</span>
          </label>
          <label>
            Instagram{" "}
            <span className="profile-help">{t("profile.optional")}</span>
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
              {t("profile.displayNameAndInstagramEditing")}
            </p>
          )}
          <div>
            <p className="profile-field-label">{t("profile.profileUrl")}</p>
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
                    setMessage(t("profile.linkCopiedAChangedUsername"));
                  } catch {
                    setMessage(t("profile.couldnTCopyTheLink"));
                  }
                }}
              >
                <span>
                  <Copy size={15} /> {t("profile.copyLink")}
                </span>
              </button>
            </div>
          </div>
        </fieldset>
        <div className="profile-save-row">
          <button className="profile-action profile-primary" disabled={busy}>
            <span>{busy ? t("profile.saving") : t("profile.saveChanges")}</span>
          </button>
          <Link href={"/u/" + savedHandle} className="profile-action">
            <span>
              <ExternalLink size={15} /> {t("profile.viewPublicProfile")}
            </span>
          </Link>
        </div>
        {message && (
          <p role="status" className="profile-feedback">
            {message}
          </p>
        )}
        <nav className="profile-account-links">
          <Link href="/studio">{t("profile.manageMyMaps")}</Link>
          <Link href="/my-proposals">{t("profile.viewMySuggestions")}</Link>
        </nav>
      </form>
      <aside className="profile-desktop-preview">
        <h2>{t("profile.publicProfilePreview")}</h2>
        <p className="profile-help">{t("profile.thisIsHowYourProfile")}</p>
        <div className="profile-preview-content">{preview}</div>
      </aside>
    </div>
  );
}
