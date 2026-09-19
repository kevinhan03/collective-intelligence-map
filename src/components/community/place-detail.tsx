"use client";
import Link from "next/link";
import { PlacePanel } from "./place-panel";
import { PlaceChecks } from "./place-checks";
import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  ExternalLink,
  Flag,
  MessageCircle,
  ThumbsDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Comment, MapPlace, Viewer } from "@/domain/types";
import { post } from "./api";
export function PlaceDetail({
  place,
  onClose,
  viewer,
  vote,
  saved,
  onChange,
  demo,
}: {
  place: MapPlace | null;
  onClose: () => void;
  viewer: Viewer | null;
  vote: number;
  saved: boolean;
  onChange: () => void;
  demo: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [report, setReport] = useState<string | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (!place) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [place, onClose]);
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
  const enabled = Boolean(viewer) && !demo;
  const votingEnabled = !demo;
  return (
    <PlacePanel title={`${place.name} 장소 상세`} onClose={onClose}>
      <aside
        aria-label={`${place.name} 장소 상세`}
        className="place-detail-panel"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            장소 상세
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="장소 상세 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="space-y-6 p-5">
          <header className="space-y-3">
            <Badge variant="secondary" className="mb-2">
              {place.category}
            </Badge>
            {place.status === "disputed" && (
              <Badge variant="outline">주제 적합성 재검토 중</Badge>
            )}
            <h2 className="text-2xl font-semibold tracking-tight">
              {place.name}
            </h2>
            <p className="text-sm text-muted-foreground">{place.address}</p>
          </header>
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
                act({ action: "vote", id: place.id, value: vote === 1 ? 0 : 1 })
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
              {demo ? (
                "가상 예시에서는 참여 기능을 사용할 수 없습니다."
              ) : (
                "투표 외 저장·댓글·장소 제안에는 로그인이 필요합니다."
              )}
            </p>
          )}
          <PlaceChecks id={place.id} enabled={enabled} demo={demo} />
          <div className="flex justify-between border-y py-3">
            <Button asChild variant="ghost" size="sm" disabled={demo}>
              {demo ? (
                <span>
                  <ExternalLink size={14} />
                  가상 예시 장소
                </span>
              ) : (
                <a href={`/go/${place.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} />
                  Google Maps에서 열기
                </a>
              )}
            </Button>
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
          <section>
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
                  const r = await fetch(`/api/map-places/${place.id}/comments`);
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
          </section>
        </div>
        <div className="place-save-bar border-t bg-card p-4">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {!viewer && !demo ? (
            <Button asChild className="h-12 w-full">
              <Link href="/login">
                <Bookmark size={18} />
                로그인하고 저장하기
              </Link>
            </Button>
          ) : (
            <Button
              className="h-12 w-full"
              variant={saved ? "secondary" : "default"}
              disabled={!enabled || busy}
              aria-pressed={saved}
              onClick={() =>
                act({ action: "save", id: place.id, enabled: !saved })
              }
            >
              <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
              {demo
                ? "미리보기에서는 저장할 수 없어요"
                : busy
                  ? "처리 중…"
                  : saved
                    ? "저장됨 · 다시 누르면 해제"
                    : "이 장소 저장하기"}
            </Button>
          )}
        </div>
      </aside>
    </PlacePanel>
  );
}
