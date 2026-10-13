"use client";
import {
  distanceMeters,
  formatDistance,
  type Coordinate,
} from "@/domain/visit";
import { useMobile } from "@/hooks/use-mobile";
import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePlaceSheetDrag } from "@/hooks/use-place-sheet-drag";
import { PlaceSheetHandle } from "./place-sheet-handle";
import { exitPlaceSheet } from "./place-sheet-motion";
import { PlacePanel } from "./place-panel";
import { PlacePhotos } from "./place-photos";
import { PlaceChecks } from "./place-checks";
import { ShareButton } from "./share-button";
import { NearbyStationInfo } from "./nearby-stations";
import { OperationSummary } from "./operation-summary";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ExternalLink,
  Flag,
  MapPin,
  MessageCircle,
  ThumbsDown,
  TrainFront,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Comment, MapPlace, Viewer, RailStation } from "@/domain/types";
import { placeArea } from "@/domain/place-location";
import { post } from "./api";
export function PlaceDetail({
  place,
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
}: {
  place: MapPlace | null;
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
}) {
  const [checksRevision, setChecksRevision] = useState(0);
  const mobile = useMobile();
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
  const [scrollBody, setScrollBody] = useState<HTMLDivElement | null>(null);
  const scrollContent = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const placeId = place?.id;
  useEffect(() => {
    const body = scrollBody;
    const content = scrollContent.current;
    if (!body || !content || !placeId) return;
    const panel = body.closest<HTMLElement>(".place-detail-panel");
    const actions = panel?.querySelector<HTMLElement>(".place-save-bar");
    const update = () => {
      if (actions)
        panel?.style.setProperty(
          "--detail-actions-height",
          `${actions.offsetHeight}px`,
        );
      setHasMoreBelow(
        body.scrollHeight - body.clientHeight - body.scrollTop > 4,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(body);
    observer.observe(content);
    if (actions) observer.observe(actions);
    body.addEventListener("scroll", update, { passive: true });
    const frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      body.removeEventListener("scroll", update);
    };
  }, [placeId, mobile, scrollBody]);
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const savedValue = savedOverride ?? saved;
  const [comments, setComments] = useState<Comment[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [report, setReport] = useState<string | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (!place || mobile) return;
    const close = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("[data-photo-dialog]")
      )
        (mobile ? collapse : onClose)();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [place, onClose, mobile, collapse]);
  useEffect(() => {
    if (!place) return;
    const controller = new AbortController();
    fetch(`/api/map-places/${place.id}/comments`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("댓글을 불러오지 못했습니다.");
        return r.json();
      })
      .then((d) => setComments(d.comments))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [place]);
  async function act(payload: unknown) {
    if (readOnly) return false;
    setBusy(true);
    setError("");
    try {
      await post("/api/community", payload);
      onChange();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!place) return null;
  const total = place.positive + place.negative;
  const enabled = Boolean(viewer) && !demo && !readOnly;
  const votingEnabled = !demo && !readOnly && !creator;
  const rationaleSection = (
    <div className="rounded-xl bg-secondary/60 p-5">
      <p className="kicker mb-2">이 테마에 추천하는 이유</p>
      <p className="text-sm leading-7">{place.rationale}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        {place.added_by ? (
          <Link href={`/u/${place.handle}`}>@{place.handle}</Link>
        ) : (
          place.handle
        )}{" "}
        · 추천 근거
      </p>
    </div>
  );
  const photoSection = (
    <PlacePhotos
      key={`photos:${place.place_id}`}
      placeId={place.place_id}
      viewer={readOnly ? null : viewer}
      readOnly={readOnly}
      loginHref={loginHref}
      demo={demo}
    />
  );
  const stationSection = !demo && (
    <details
      key={`stations:${place.place_id}`}
      className="station-disclosure group/stations rounded-xl border px-3"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <TrainFront size={16} aria-hidden="true" />
        <span className="flex-1">가까운 지하철·기차역</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="transition-transform group-open/stations:rotate-180"
        />
      </summary>
      <div className="pb-3">
        <NearbyStationInfo
          place={place}
          demo={demo}
          onSelect={onStationSelect}
        />
      </div>
    </details>
  );
  return (
    <PlacePanel title={`${place.name} 장소 상세`} onClose={collapse}>
      <aside
        aria-label={`${place.name} 장소 상세`}
        className="place-detail-panel"
      >
        {mobile ? (
          <div className="place-sheet-drag-zone" {...drag}>
            <PlaceSheetHandle stage="detail" onCollapse={collapse} />
          </div>
        ) : (
          <div className="place-detail-topbar sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-3">
            <span className="text-xs font-medium text-muted-foreground">
              장소 상세
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="장소 상세 닫기"
              onClick={closeSelection}
            >
              <X size={18} />
            </Button>
          </div>
        )}
        <div
          ref={setScrollBody}
          className="place-detail-scroll"
          tabIndex={0}
          aria-label={`${place.name} 상세 내용`}
        >
          <div ref={scrollContent} className="space-y-6 p-5">
            <header className="space-y-3">
              {place.status === "disputed" && (
                <Badge variant="outline">주제 적합성 재검토 중</Badge>
              )}
              <div
                className={
                  mobile
                    ? "place-sheet-title-row place-sheet-drag-zone"
                    : "flex items-center justify-between gap-3"
                }
                {...(mobile ? drag : {})}
              >
                <h2
                  className={
                    mobile
                      ? "place-sheet-title"
                      : "min-w-0 text-2xl font-semibold tracking-tight break-words"
                  }
                >
                  {place.name}
                </h2>
                {mobile && (
                  <Button
                    className="shrink-0"
                    variant="ghost"
                    size="icon"
                    aria-label="장소 상세 닫기"
                    onClick={closeSelection}
                  >
                    <X size={18} />
                  </Button>
                )}
              </div>
              {placeArea(place.address) && (
                <p className="text-sm font-medium text-primary">
                  {placeArea(place.address)}
                </p>
              )}
              <p className="text-sm text-muted-foreground">{place.address}</p>
              {userLocation && (
                <p className="text-xs text-muted-foreground">
                  내 위치에서 직선거리{" "}
                  {formatDistance(distanceMeters(userLocation, place))}
                </p>
              )}
              <OperationSummary
                key={place.id}
                id={place.id}
                demo={demo}
                revision={checksRevision}
              />
              {!mobile && stationSection}
              <div
                className={
                  mobile
                    ? "place-detail-share-row flex items-start justify-between gap-3"
                    : "flex flex-wrap items-center gap-3"
                }
              >
                {!mobile && !readOnly && (
                  <a
                    href={sharePath}
                    className="text-xs text-primary underline"
                  >
                    장소 소개 페이지 보기
                  </a>
                )}
                {!readOnly && (
                  <ShareButton path={sharePath} title={place.name} />
                )}
                {mobile && onViewMap && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-start rounded-full"
                    onClick={() => exitPlaceSheet(onViewMap, true)}
                  >
                    <MapPin
                      size={14}
                      className="text-primary"
                      aria-hidden="true"
                    />
                    지도에서 보기
                  </Button>
                )}
              </div>
            </header>
            {mobile ? (
              <>
                {rationaleSection}
                {photoSection}
                {stationSection}
              </>
            ) : (
              <>
                {photoSection}
                {rationaleSection}
              </>
            )}
            {!creator && (
              <ParticipationSection mobile={mobile} title="이 주제에 맞나요?">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">이 주제에 맞나요?</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {total
                        ? `${total}명 중 ${place.positive}명이 이 주제에 맞다고 했어요.`
                        : "아직 검증이 없어요. 첫 경험을 더해 주세요."}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  주제 적합성에 대한 의견이에요. 실제 방문 확인과는 별개예요.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={vote === 1 ? "default" : "outline"}
                    disabled={!votingEnabled || busy}
                    onClick={() =>
                      act({
                        action: "vote",
                        id: place.id,
                        value: vote === 1 ? 0 : 1,
                      })
                    }
                  >
                    <Check size={15} />
                    적합해요 {place.positive}
                  </Button>
                  <Button
                    variant={vote === -1 ? "default" : "outline"}
                    disabled={!votingEnabled || busy}
                    onClick={() =>
                      act({
                        action: "vote",
                        id: place.id,
                        value: vote === -1 ? 0 : -1,
                      })
                    }
                  >
                    <ThumbsDown size={14} />
                    맞지 않아요 {place.negative}
                  </Button>
                </div>
                {!enabled && (
                  <p className="text-xs text-muted-foreground">
                    {demo
                      ? "가상 예시에서는 참여 기능을 사용할 수 없습니다."
                      : "투표 외 저장·댓글·장소 제안에는 로그인이 필요합니다."}
                  </p>
                )}
              </ParticipationSection>
            )}
            <ParticipationSection mobile={mobile} title="더 보기">
              {mobile && !readOnly && (
                <a
                  href={sharePath}
                  className="inline-flex min-h-11 items-center text-sm text-primary underline"
                >
                  장소 소개 페이지 보기
                </a>
              )}
              <div className="flex justify-end border-y py-3">
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
            </ParticipationSection>
            {report && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
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
                className="space-y-2"
              >
                <label htmlFor="report-reason" className="text-sm font-medium">
                  신고 사유
                </label>
                <Textarea
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
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
            <ParticipationSection
              mobile={mobile}
              title={`이 장소에 대한 대화 ${comments.length}`}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <MessageCircle size={15} />이 장소에 대한 대화{" "}
                <span className="text-muted-foreground">{comments.length}</span>
              </h3>
              {comments.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">
                  아직 대화가 없어요. 이 장소에 대한 경험을 들려주세요.
                </p>
              )}
              <div className="space-y-4">
                {comments.map((c) => (
                  <article key={c.id} className="border-b pb-3">
                    <div className="flex justify-between">
                      <Link
                        href={`/u/${c.handle}`}
                        className="text-xs font-semibold"
                      >
                        @{c.handle}
                      </Link>
                      {enabled && (
                        <div className="flex gap-2">
                          {c.author_id === viewer?.id && (
                            <button
                              className="text-xs text-muted-foreground"
                              onClick={async () => {
                                if (
                                  await act({
                                    action: "delete_comment",
                                    id: c.id,
                                  })
                                )
                                  setComments((v) =>
                                    v.filter((x) => x.id !== c.id),
                                  );
                              }}
                            >
                              삭제
                            </button>
                          )}
                          <button
                            className="text-xs text-muted-foreground"
                            onClick={() => setReport(c.id)}
                          >
                            신고
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {c.body}
                    </p>
                  </article>
                ))}
              </div>
              <form
                className="mt-4 space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await act({ action: "comment", id: place.id, body })) {
                    setBody("");
                    const r = await fetch(
                      `/api/map-places/${place.id}/comments`,
                    );
                    if (r.ok) setComments((await r.json()).comments);
                  }
                }}
              >
                <Textarea
                  aria-label="댓글"
                  placeholder="주제와 연결되는 나의 경험을 남겨 주세요."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  minLength={2}
                  maxLength={2000}
                  required
                  disabled={!enabled}
                />
                <Button size="sm" disabled={!enabled || busy}>
                  댓글 남기기
                </Button>
              </form>
            </ParticipationSection>
            <ParticipationSection mobile={mobile} title="최근 방문·운영 정보">
              <PlaceChecks
                id={place.id}
                enabled={enabled}
                demo={demo}
                onChange={() => setChecksRevision((v) => v + 1)}
              />
            </ParticipationSection>
          </div>
        </div>
        <div className="place-save-bar border-t bg-card p-4">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {!viewer && !demo && !readOnly ? (
              <Button asChild className="h-12">
                <Link href={loginHref}>
                  <Bookmark size={17} /> 저장하기
                </Link>
              </Button>
            ) : (
              <Button
                className="h-12"
                variant={savedValue ? "secondary" : "default"}
                disabled={!enabled || busy}
                aria-pressed={savedValue}
                onClick={async () => {
                  if (
                    await act({
                      action: "save",
                      id: place.id,
                      enabled: !savedValue,
                    })
                  )
                    setSavedOverride(!savedValue);
                }}
              >
                <Bookmark
                  size={17}
                  fill={savedValue ? "currentColor" : "none"}
                />
                {demo
                  ? "저장 불가"
                  : busy
                    ? "처리 중…"
                    : savedValue
                      ? "저장됨"
                      : "저장하기"}
              </Button>
            )}
            {demo || readOnly ? (
              <Button variant="outline" className="h-12" disabled>
                <ExternalLink size={17} /> 길찾기
              </Button>
            ) : (
              <Button asChild variant="outline" className="h-12">
                <a href={`/go/${place.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink size={17} /> 길찾기
                </a>
              </Button>
            )}
          </div>
        </div>
        {hasMoreBelow && (
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
  mobile,
  title,
  children,
}: {
  mobile: boolean;
  title: string;
  children: ReactNode;
}) {
  if (!mobile) return <>{children}</>;
  return (
    <details className="participation-section border-t">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between py-3 font-semibold">
        {title}
        <span aria-hidden="true">＋</span>
      </summary>
      <div className="space-y-4 pb-4">{children}</div>
    </details>
  );
}
