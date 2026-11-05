"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "@/i18n/link";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ExternalLink,
  Flag,
  MapPin,
  ThumbsDown,
  ThumbsUp,
  TrainFront,
  X,
} from "lucide-react";
import {
  distanceMeters,
  formatDistance,
  type Coordinate,
} from "@/domain/visit";
import type { MapPlace, Viewer, RailStation } from "@/domain/types";
import { placeArea } from "@/domain/place-location";
import { useMobile } from "@/hooks/use-mobile";
import { usePlaceSheetDrag } from "@/hooks/use-place-sheet-drag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlaceSheetHandle } from "./place-sheet-handle";
import { exitPlaceSheet } from "./place-sheet-motion";
import { PlacePanel } from "./place-panel";
import { PlacePhotos } from "./place-photos";
import { PlaceMaps } from "./place-maps";
import { PlaceTags } from "./place-tags";
import { PlaceBackdrop } from "./place-backdrop";
import { PlaceChecks } from "./place-checks";
import { PlaceIntroductions } from "./place-introductions";
import { PlaceComments } from "./place-comments";
import { CommentAvatar } from "./comment-avatar";
import { usePlaceComments } from "./use-place-comments";
import { ShareButton } from "./share-button";
import { SingleLineText } from "./single-line-text";
import { NearbyStationInfo } from "./nearby-stations";
import { OperationSummary } from "./operation-summary";
import { ApiError, post } from "./api";

import { useI18n } from "@/i18n/client";
export function PlaceDetail({
  place,
  mapTitle: mapTitleProp,
  userLocation,
  onClose,
  onCollapse,
  onViewMap,
  viewer,
  loginHref,
  vote,
  saved,
  onChange,
  demo,
  readOnly = false,
  creator = false,
  sharePath,
  onStationSelect,
  initialComments = false,
  onVote,
  onSave,
  votePending = false,
  savePending = false,
}: {
  place: MapPlace | null;
  mapTitle?: string;
  userLocation: Coordinate | null;
  onClose: () => void;
  onCollapse?: () => void;
  onViewMap?: () => void;
  viewer: Viewer | null;
  loginHref: string;
  vote: number;
  saved: boolean;
  onChange: () => void;
  demo: boolean;
  readOnly?: boolean;
  creator?: boolean;
  sharePath: string;
  onStationSelect: (station: RailStation) => void;
  initialComments?: boolean;
  onVote?: (value: 1 | -1) => Promise<void>;
  onSave?: () => Promise<void>;
  votePending?: boolean;
  savePending?: boolean;
}) {
  const { t } = useI18n();
  const mapTitle = mapTitleProp ?? t("place.thisMap");
  const mobile = useMobile();
  const [mode, setMode] = useState<"detail" | "comments">(
    initialComments ? "comments" : "detail",
  );
  const thread = usePlaceComments(place?.id ?? "", demo || !place);
  const [checksRevision, setChecksRevision] = useState(0);
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [report, setReport] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const previewButton = useRef<HTMLButtonElement>(null);
  const detailScrollTop = useRef(0);
  const commentsHeading = useRef<HTMLHeadingElement>(null);
  const [scrollBody, setScrollBody] = useState<HTMLDivElement | null>(null);
  const scrollContent = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const savedValue = savedOverride ?? saved;
  const collapse = useCallback(() => {
    const callback = onCollapse ?? onClose;
    if (mobile) exitPlaceSheet(callback);
    else callback();
  }, [mobile, onCollapse, onClose]);
  const closeSelection = () => {
    if (mobile) exitPlaceSheet(onClose, true);
    else onClose();
  };
  const drag = usePlaceSheetDrag(undefined, collapse);
  const backToDetail = useCallback(() => {
    setReport(null);
    setMode("detail");
    requestAnimationFrame(() => {
      if (scrollBody) scrollBody.scrollTop = detailScrollTop.current;
      previewButton.current?.focus({ preventScroll: true });
    });
  }, [scrollBody]);
  useEffect(() => {
    if (mode === "comments")
      commentsHeading.current?.focus({ preventScroll: true });
  }, [mode]);
  useEffect(() => {
    if (!place) return;
    const close = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector("[data-photo-dialog], [data-radix-menu-content]")
      )
        return;
      if (mode === "comments") {
        event.preventDefault();
        backToDetail();
      } else if (!mobile) onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [place, mobile, mode, onClose, backToDetail]);
  useEffect(() => {
    const content = scrollContent.current;
    if (!scrollBody || !content || mode !== "detail") return;
    const update = () =>
      setHasMoreBelow(
        scrollBody.scrollHeight -
          scrollBody.clientHeight -
          scrollBody.scrollTop >
          4,
      );
    const observer = new ResizeObserver(update);
    observer.observe(scrollBody);
    observer.observe(content);
    scrollBody.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      scrollBody.removeEventListener("scroll", update);
    };
  }, [scrollBody, mode]);
  async function act(payload: unknown) {
    if (!viewer) {
      window.location.assign(loginHref);
      return false;
    }
    if (readOnly || submitting.current) return false;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await post("/api/community", payload);
      onChange();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign(loginHref);
        return false;
      }
      setError((error as Error).message);
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (!place) return null;
  const enabled = Boolean(viewer) && !demo && !readOnly;
  const votingEnabled = !demo && !readOnly && !creator;
  const openComments = () => {
    detailScrollTop.current = scrollBody?.scrollTop ?? 0;
    setMode("comments");
  };
  const saveAction =
    !viewer && !demo && !readOnly ? (
      <Link
        href={loginHref}
        className="detail-icon-action"
        aria-label={t("place.signInToSavePlaces")}
      >
        <Bookmark size={21} />
      </Link>
    ) : (
      <button
        type="button"
        className="detail-icon-action detail-save-action"
        aria-label={
          savedValue
            ? t("place.unsave", { name: place.name })
            : t("place.save", { name: place.name })
        }
        aria-pressed={savedValue}
        disabled={!enabled || savePending || busy}
        onClick={async () => {
          if (onSave) {
            await onSave();
            return;
          }
          if (await act({ action: "save", id: place.id, enabled: !savedValue }))
            setSavedOverride(!savedValue);
        }}
      >
        <Bookmark size={21} fill={savedValue ? "currentColor" : "none"} />
      </button>
    );
  return (
    <PlacePanel
      title={`${place.name} ${mode === "comments" ? t("place.comment") : t("place.placeDetails")}`}
      onClose={mode === "comments" ? backToDetail : collapse}
    >
      <aside
        aria-label={t("place.details", { name: place.name })}
        className="place-detail-panel"
        data-mode={mode}
      >
        {mode === "detail" && (
          <PlaceBackdrop
            key={place.place_id}
            placeId={place.place_id}
            demo={demo}
          />
        )}
        {mobile && (
          <div className="place-sheet-drag-zone" {...drag}>
            <PlaceSheetHandle stage="detail" onCollapse={collapse} />
          </div>
        )}
        <header
          className={`place-detail-heading ${!mobile ? "place-detail-topbar" : ""}`}
        >
          {mode === "comments" ? (
            <>
              <button
                type="button"
                className="detail-icon-action"
                aria-label={t("place.backToPlaceDetails")}
                onClick={backToDetail}
              >
                <ArrowLeft size={22} />
              </button>
              <h2 ref={commentsHeading} tabIndex={-1}>
                {t("place.commentsHeading")} <span>{thread.total}</span>
              </h2>
            </>
          ) : (
            <h2 className="place-sheet-title">{place.name}</h2>
          )}
          <div className="detail-heading-actions">
            {mode === "detail" && !readOnly && (
              <ShareButton path={sharePath} title={place.name} iconOnly />
            )}
            {mode === "detail" && saveAction}
            <button
              type="button"
              className="detail-icon-action"
              aria-label={t("place.closePlaceDetails")}
              onClick={closeSelection}
            >
              <X size={21} />
            </button>
          </div>
        </header>
        {error && (
          <p role="alert" className="detail-error">
            {error}
          </p>
        )}
        {report && (
          <form
            className="detail-report-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await act({
                  action: "report",
                  id: report,
                  target: report === place.id ? "map_place" : "comment",
                  reason,
                })
              ) {
                setReport(null);
                setReason("");
              }
            }}
          >
            <label htmlFor="report-reason">{t("place.reasonForReport")}</label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={5}
              maxLength={1000}
              required
              placeholder={t("place.tellUsExactlyWhatNeeds")}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy}>
                {t("place.submitReport")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReport(null)}
              >
                {t("place.cancel")}
              </Button>
            </div>
          </form>
        )}
        {mode === "comments" && (
          <>
            <p className="comments-place-name">{place.name}</p>
            <PlaceComments
              thread={thread}
              placeId={place.id}
              placeName={place.name}
              viewer={viewer}
              enabled={enabled}
              demo={demo || readOnly}
              loginHref={loginHref}
              onReport={setReport}
            />
          </>
        )}
        <div
          ref={setScrollBody}
          className="place-detail-scroll"
          style={mode === "comments" ? { display: "none" } : undefined}
          tabIndex={0}
          aria-label={t("place.details2", { name: place.name })}
        >
          <div ref={scrollContent} className="place-detail-content">
            <div className="place-detail-meta">
              {place.status === "disputed" && (
                <Badge variant="outline">
                  {t("place.themeFitUnderReReview")}
                </Badge>
              )}
              {t.area(placeArea(place.address)) && (
                <p className="text-sm font-medium text-primary">
                  {t.area(placeArea(place.address))}
                </p>
              )}
            </div>
            <PlaceIntroductions
              key={`introductions:${place.id}:${viewer?.id ?? "guest"}`}
              place={place}
              viewer={viewer}
              demo={demo}
              readOnly={readOnly}
              loginHref={loginHref}
              onReport={setReport}
            />
            <PlaceTags
              key={`tags:${place.id}:${viewer?.id ?? "guest"}`}
              id={place.id}
              onChange={onChange}
            />
            {!creator && (
              <section
                className="place-theme-reactions"
                aria-label={t("place.themeFit")}
              >
                <SingleLineText>
                  {t("place.doesThisPlaceFit", { mapTitle })}
                </SingleLineText>
                <div className="place-theme-actions">
                  <button
                    type="button"
                    className="detail-reaction"
                    aria-label={t("place.fitsThisMap", {
                      positive: place.positive,
                    })}
                    aria-pressed={vote === 1}
                    disabled={!votingEnabled || votePending || busy}
                    onClick={() =>
                      onVote
                        ? onVote(1)
                        : act({
                            action: "vote",
                            id: place.id,
                            value: vote === 1 ? 0 : 1,
                          })
                    }
                  >
                    <ThumbsUp size={21} />
                    <span>{place.positive}</span>
                  </button>
                  <button
                    type="button"
                    className="detail-reaction"
                    aria-label={t("place.doesnTFitThisMap", {
                      negative: place.negative,
                    })}
                    aria-pressed={vote === -1}
                    disabled={!votingEnabled || votePending || busy}
                    onClick={() =>
                      onVote
                        ? onVote(-1)
                        : act({
                            action: "vote",
                            id: place.id,
                            value: vote === -1 ? 0 : -1,
                          })
                    }
                  >
                    <ThumbsDown size={21} />
                    <span>{place.negative}</span>
                  </button>
                </div>
              </section>
            )}
            <button
              ref={previewButton}
              type="button"
              className="place-comment-preview"
              onClick={openComments}
              aria-label={t("place.viewAllComments", { total: thread.total })}
            >
              <span className="comment-preview-title">
                {t("place.comment")} <span>{thread.total}</span>
              </span>
              <span className="comment-preview-body">
                <CommentAvatar
                  path={thread.comments[0]?.avatar_path}
                  handle={thread.comments[0]?.handle}
                />
                <span>
                  {thread.loading && !thread.comments.length
                    ? t("place.loadingComments")
                    : thread.error && !thread.comments.length
                      ? t("place.couldnTLoadCommentsTap")
                      : (thread.comments[0]?.body ??
                        t("place.beTheFirstToShare"))}
                </span>
              </span>
            </button>
            <PlacePhotos
              key={`photos:${place.place_id}`}
              placeId={place.place_id}
              viewer={readOnly ? null : viewer}
              readOnly={readOnly}
              loginHref={loginHref}
              demo={demo}
            />
            <section
              className="place-stations-section"
              aria-label={t("place.nearbyStationsAndDirections")}
            >
              <div className="place-stations-heading">
                <details className="station-disclosure group/stations">
                  <summary>
                    <TrainFront size={17} />
                    <span>{t("place.nearbyStations")}</span>
                    <ChevronDown
                      size={15}
                      className="transition-transform group-open/stations:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="place-stations-body">
                    <p className="text-sm text-muted-foreground">
                      {place.address}
                    </p>
                    {userLocation && (
                      <p className="text-xs text-muted-foreground">
                        {t("place.distanceFromYou")}{" "}
                        {formatDistance(distanceMeters(userLocation, place))}
                      </p>
                    )}
                    <NearbyStationInfo
                      key={place.place_id}
                      place={place}
                      demo={demo}
                      onSelect={onStationSelect}
                    />
                  </div>
                </details>
                {demo || readOnly ? (
                  <Button variant="ghost" disabled>
                    <ExternalLink size={16} />
                    {t("place.directions")}
                  </Button>
                ) : (
                  <Button asChild variant="ghost">
                    <a
                      href={`/go/${place.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={16} />
                      {t("place.directions")}
                    </a>
                  </Button>
                )}
              </div>
            </section>
            <ParticipationSection title={t("place.recentVisitsAndOpeningInfo")}>
              <OperationSummary
                key={place.id}
                id={place.id}
                demo={demo}
                revision={checksRevision}
              />
              <PlaceChecks
                id={place.id}
                enabled={enabled}
                demo={demo}
                onChange={() => setChecksRevision((value) => value + 1)}
              />
            </ParticipationSection>
            <ParticipationSection title={t("place.showMore")}>
              <div className="flex flex-wrap items-center gap-3">
                {onViewMap && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      mobile ? exitPlaceSheet(onViewMap, true) : onViewMap()
                    }
                  >
                    <MapPin size={14} />
                    {t("place.viewOnMap")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!enabled}
                  onClick={() => setReport(place.id)}
                >
                  <Flag size={13} />
                  {t("place.report")}
                </Button>
              </div>
              {!readOnly && (
                <Link
                  href={sharePath}
                  className="inline-flex min-h-11 items-center text-sm text-primary underline"
                >
                  {t("place.viewPlacePage")}
                </Link>
              )}
            </ParticipationSection>
            <PlaceMaps
              key={`maps:${place.place_id}:${place.map_id}`}
              placeId={place.place_id}
              currentMapId={place.map_id}
            />
          </div>
        </div>
        {hasMoreBelow && mode === "detail" && (
          <div className="place-detail-scroll-hint" aria-hidden="true">
            <span>
              {t("place.scrollDownForMore")} <ChevronDown size={14} />
            </span>
          </div>
        )}
      </aside>
    </PlacePanel>
  );
}
function ParticipationSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="participation-section">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 py-3 text-sm font-semibold">
        {title}
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="space-y-4 pb-4">{children}</div>
    </details>
  );
}
