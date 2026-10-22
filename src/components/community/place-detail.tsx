"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
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
import { post } from "./api";

export function PlaceDetail({
  place,
  mapTitle = "이 지도",
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
    if (readOnly || submitting.current) return false;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await post("/api/community", payload);
      onChange();
      return true;
    } catch (error) {
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
        aria-label="로그인하고 장소 저장"
      >
        <Bookmark size={21} />
      </Link>
    ) : (
      <button
        type="button"
        className="detail-icon-action detail-save-action"
        aria-label={
          savedValue ? `${place.name} 저장 해제` : `${place.name} 저장`
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
      title={`${place.name} ${mode === "comments" ? "댓글" : "장소 상세"}`}
      onClose={mode === "comments" ? backToDetail : collapse}
    >
      <aside
        aria-label={`${place.name} 장소 상세`}
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
                aria-label="장소 상세로 돌아가기"
                onClick={backToDetail}
              >
                <ArrowLeft size={22} />
              </button>
              <h2 ref={commentsHeading} tabIndex={-1}>
                댓글 <span>{thread.total}</span>
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
              aria-label="장소 상세 닫기"
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
            <label htmlFor="report-reason">신고 사유</label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={5}
              maxLength={1000}
              required
              placeholder="확인이 필요한 내용을 구체적으로 알려 주세요."
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy}>
                신고 접수
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReport(null)}
              >
                취소
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
          aria-label={`${place.name} 상세 내용`}
        >
          <div ref={scrollContent} className="place-detail-content">
            <div className="place-detail-meta">
              {place.status === "disputed" && (
                <Badge variant="outline">주제 적합성 재검토 중</Badge>
              )}
              {placeArea(place.address) && (
                <p className="text-sm font-medium text-primary">
                  {placeArea(place.address)}
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
            {!creator && (
              <section
                className="place-theme-reactions"
                aria-label="주제 적합성"
              >
                <SingleLineText>{`${mapTitle}에 어울리는 장소인가요?`}</SingleLineText>
                <div className="place-theme-actions">
                  <button
                    type="button"
                    className="detail-reaction"
                    aria-label={`이 지도에 어울려요 ${place.positive}`}
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
                    aria-label={`이 지도에 어울리지 않아요 ${place.negative}`}
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
              aria-label={`댓글 ${thread.total}개 모두 보기`}
            >
              <span className="comment-preview-title">
                댓글 <span>{thread.total}</span>
              </span>
              <span className="comment-preview-body">
                <CommentAvatar
                  path={thread.comments[0]?.avatar_path}
                  handle={thread.comments[0]?.handle}
                />
                <span>
                  {thread.loading && !thread.comments.length
                    ? "댓글을 불러오는 중…"
                    : thread.error && !thread.comments.length
                      ? "댓글을 불러오지 못했어요. 눌러서 다시 시도해 주세요."
                      : (thread.comments[0]?.body ??
                        "첫 댓글로 이 장소의 경험을 나눠 주세요.")}
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
              aria-label="가까운 지하철·기차역 및 길찾기"
            >
              <div className="place-stations-heading">
                <details className="station-disclosure group/stations">
                  <summary>
                    <TrainFront size={17} />
                    <span>가까운 지하철·기차역</span>
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
                        내 위치에서 직선거리{" "}
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
                    길찾기
                  </Button>
                ) : (
                  <Button asChild variant="ghost">
                    <a
                      href={`/go/${place.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={16} />
                      길찾기
                    </a>
                  </Button>
                )}
              </div>
            </section>
            <ParticipationSection title="최근 방문·운영 정보">
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
            <ParticipationSection title="더 보기">
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
                    지도에서 보기
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!enabled}
                  onClick={() => setReport(place.id)}
                >
                  <Flag size={13} />
                  신고
                </Button>
              </div>
              {!readOnly && (
                <Link
                  href={sharePath}
                  className="inline-flex min-h-11 items-center text-sm text-primary underline"
                >
                  장소 소개 페이지 보기
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
              아래로 스크롤해 더 보기 <ChevronDown size={14} />
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
