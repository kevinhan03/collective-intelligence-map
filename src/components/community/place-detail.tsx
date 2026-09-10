"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  ExternalLink,
  Flag,
  MessageCircle,
  ThumbsDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  return (
    <Dialog
      open={Boolean(place)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <Badge variant="secondary" className="mb-2">
            {place.category}
          </Badge>
          {place.status === "disputed" && (
            <Badge variant="outline">주제 적합성 재검토 중</Badge>
          )}
          <DialogTitle className="text-2xl">{place.name}</DialogTitle>
          <DialogDescription>{place.address}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-secondary/60 p-5">
          <p className="kicker mb-2">Why it belongs here</p>
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
                ? `${Math.round((place.positive / total) * 100)}% 적합 · ${total}명이 검증`
                : "아직 검증이 없어요. 첫 경험을 더해 주세요."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!enabled || busy}
            onClick={() =>
              act({ action: "save", id: place.id, enabled: !saved })
            }
          >
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
            {saved ? "저장됨" : "저장"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={vote === 1 ? "default" : "outline"}
            disabled={!enabled || busy}
            onClick={() =>
              act({ action: "vote", id: place.id, value: vote === 1 ? 0 : 1 })
            }
          >
            <Check size={15} />
            적합해요 {place.positive}
          </Button>
          <Button
            variant={vote === -1 ? "default" : "outline"}
            disabled={!enabled || busy}
            onClick={() =>
              act({ action: "vote", id: place.id, value: vote === -1 ? 0 : -1 })
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
              <Link href="/login" className="underline">
                로그인하고 방문 경험을 나눠 주세요.
              </Link>
            )}
          </p>
        )}
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
                외부 지도 열기
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
                              await act({ action: "delete_comment", id: c.id })
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
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
