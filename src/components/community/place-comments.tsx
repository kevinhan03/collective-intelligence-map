"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Heart, MessageCircle, MoreHorizontal } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { Viewer } from "@/domain/types";
import { Textarea } from "@/components/ui/textarea";
import { CommentAvatar } from "./comment-avatar";
import { post } from "./api";
import type { usePlaceComments } from "./use-place-comments";

type Thread = ReturnType<typeof usePlaceComments>;
export function PlaceComments({
  thread,
  viewer,
  enabled,
  demo,
  loginHref,
  placeId,
  placeName,
  onReport,
}: {
  thread: Thread;
  viewer: Viewer | null;
  enabled: boolean;
  demo: boolean;
  loginHref: string;
  placeId: string;
  placeName: string;
  onReport: (id: string) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const writing = useRef(false);
  const liking = useRef(new Set<string>());
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const showNewest = useRef(false);
  useEffect(() => {
    if (!showNewest.current || thread.loading) return;
    if (thread.error) {
      showNewest.current = false;
      return;
    }
    if (thread.hasMore) {
      void thread.reload(thread.comments.length);
      return;
    }
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    showNewest.current = false;
  }, [thread]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (writing.current || !enabled || body.trim().length < 2) return;
    writing.current = true;
    setBusy(true);
    setError("");
    try {
      await post("/api/community", {
        action: "comment",
        id: placeId,
        body: body.trim(),
      });
      setBody("");
      showNewest.current = true;
      await thread.reload();
      input.current?.focus();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="place-comments-list place-detail-scroll"
        tabIndex={0}
        aria-label="전체 댓글"
        data-empty={
          thread.comments.length === 0 && !thread.loading && !thread.error
        }
      >
        {thread.comments.length === 0 && !thread.loading && !thread.error && (
          <section className="comments-empty" aria-label="댓글 없음">
            <MessageCircle size={28} strokeWidth={1.5} aria-hidden="true" />
            <h3>아직 댓글이 없어요</h3>
            <p>{placeName}에서 어떤 경험을 하셨나요?</p>
          </section>
        )}
        {thread.comments.map((comment) => (
          <article key={comment.id} className="place-comment-row">
            <CommentAvatar path={comment.avatar_path} handle={comment.handle} />
            <div className="place-comment-copy">
              <div className="place-comment-author">
                {comment.author_id ? (
                  <Link href={`/u/${comment.handle}`}>@{comment.handle}</Link>
                ) : (
                  <span>{comment.handle}</span>
                )}
                <time dateTime={comment.created_at}>
                  {new Date(comment.created_at).toLocaleDateString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </time>
                {enabled && (
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="comment-menu-trigger"
                        aria-label={`@${comment.handle} 댓글 메뉴`}
                        disabled={busy}
                      >
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="place-context-menu"
                        align="end"
                        sideOffset={4}
                      >
                        {comment.author_id === viewer?.id && (
                          <DropdownMenu.Item
                            className="place-context-menu-item text-destructive"
                            disabled={busy}
                            onSelect={async () => {
                              if (writing.current) return;
                              writing.current = true;
                              setBusy(true);
                              setError("");
                              try {
                                await post("/api/community", {
                                  action: "delete_comment",
                                  id: comment.id,
                                });
                                await thread.reload();
                              } catch (error) {
                                setError((error as Error).message);
                              } finally {
                                writing.current = false;
                                setBusy(false);
                              }
                            }}
                          >
                            삭제
                          </DropdownMenu.Item>
                        )}
                        <DropdownMenu.Item
                          className="place-context-menu-item"
                          onSelect={() => onReport(comment.id)}
                        >
                          신고
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                )}
              </div>
              <p>{comment.body}</p>
            </div>
            <button
              type="button"
              className="comment-like"
              aria-label={`@${comment.handle} 댓글 좋아요 ${comment.likes ?? 0}`}
              aria-pressed={comment.liked ?? false}
              disabled={
                demo ||
                (Boolean(viewer) && !enabled) ||
                pendingLikes.has(comment.id)
              }
              onClick={async () => {
                if (!viewer) {
                  window.location.assign(loginHref);
                  return;
                }
                if (liking.current.has(comment.id)) return;
                liking.current.add(comment.id);
                setPendingLikes(new Set(liking.current));
                setError("");
                try {
                  const result = await post<{ likes: number; liked: boolean }>(
                    `/api/comments/${comment.id}/like`,
                    { enabled: !comment.liked },
                  );
                  thread.setThread((previous) => ({
                    ...previous,
                    comments: previous.comments.map((c) =>
                      c.id === comment.id ? { ...c, ...result } : c,
                    ),
                  }));
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  liking.current.delete(comment.id);
                  setPendingLikes(new Set(liking.current));
                }
              }}
            >
              <Heart
                size={19}
                fill={comment.liked ? "currentColor" : "none"}
                aria-hidden="true"
              />
              <span>{comment.likes ?? 0}</span>
            </button>
          </article>
        ))}
        {thread.loading && (
          <p role="status" className="comments-feedback">
            댓글을 불러오는 중…
          </p>
        )}
        {thread.error && (
          <p role="alert" className="comments-feedback">
            {thread.error}{" "}
            <button onClick={() => thread.reload()} className="underline">
              다시 시도
            </button>
          </p>
        )}
        {thread.hasMore && !thread.loading && (
          <button
            className="comments-load-more"
            onClick={() => thread.reload(thread.comments.length)}
          >
            댓글 더 불러오기
          </button>
        )}
        <div ref={end} />
      </div>
      <div className="place-comment-composer">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!enabled ? (
          <p className="comments-feedback">
            {!viewer && !demo ? (
              <Link href={loginHref}>로그인하고 댓글 남기기</Link>
            ) : (
              "현재 댓글을 작성할 수 없어요."
            )}
          </p>
        ) : (
          <form onSubmit={submit}>
            <CommentAvatar path={viewer?.avatar_path} handle={viewer?.handle} />
            <Textarea
              ref={input}
              aria-label="댓글"
              placeholder="댓글을 남겨 주세요"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={2}
              maxLength={2000}
              required
              disabled={busy}
              rows={1}
            />
            <button
              type="submit"
              className="comment-send"
              aria-label="댓글 등록"
              disabled={busy || body.trim().length < 2}
            >
              <ArrowUp size={22} />
            </button>
          </form>
        )}
      </div>
    </>
  );
}
