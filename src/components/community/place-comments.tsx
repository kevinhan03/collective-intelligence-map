"use client";
import { useEffect, useRef, useState } from "react";
import Link from "@/i18n/link";
import { ArrowUp, Heart, MessageCircle, MoreHorizontal } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { Viewer } from "@/domain/types";
import { Textarea } from "@/components/ui/textarea";
import { CommentAvatar } from "./comment-avatar";
import { post } from "./api";
import type { usePlaceComments } from "./use-place-comments";

import { useI18n } from "@/i18n/client";
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
  const { t } = useI18n();
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
      setError(t.message((error as Error).message));
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
        aria-label={t("place.allComments")}
        data-empty={
          thread.comments.length === 0 && !thread.loading && !thread.error
        }
      >
        {thread.comments.length === 0 && !thread.loading && !thread.error && (
          <section
            className="comments-empty"
            aria-label={t("place.noComments")}
          >
            <MessageCircle size={28} strokeWidth={1.5} aria-hidden="true" />
            <h3>{t("place.noCommentsYet")}</h3>
            <p>{t("place.howWasYourVisit", { name: placeName })}</p>
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
                  <span>{t.message(comment.handle)}</span>
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
                        aria-label={t("place.commentMenuFor", {
                          handle: comment.handle,
                        })}
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
                                setError(t.message((error as Error).message));
                              } finally {
                                writing.current = false;
                                setBusy(false);
                              }
                            }}
                          >
                            {t("place.delete")}
                          </DropdownMenu.Item>
                        )}
                        <DropdownMenu.Item
                          className="place-context-menu-item"
                          onSelect={() => onReport(comment.id)}
                        >
                          {t("place.report")}
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
              aria-label={t("place.likeComment", {
                handle: comment.handle,
                count: comment.likes ?? 0,
              })}
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
                  setError(t.message((error as Error).message));
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
            {t("place.loadingComments")}
          </p>
        )}
        {thread.error && (
          <p role="alert" className="comments-feedback">
            {t.message(thread.error)}{" "}
            <button onClick={() => thread.reload()} className="underline">
              {t("place.tryAgain")}
            </button>
          </p>
        )}
        {thread.hasMore && !thread.loading && (
          <button
            className="comments-load-more"
            onClick={() => thread.reload(thread.comments.length)}
          >
            {t("place.loadMoreComments")}
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
              <Link href={loginHref}>{t("place.signInToComment")}</Link>
            ) : (
              t("place.commentsAreUnavailableRightNow")
            )}
          </p>
        ) : (
          <form onSubmit={submit}>
            <CommentAvatar path={viewer?.avatar_path} handle={viewer?.handle} />
            <Textarea
              ref={input}
              aria-label={t("place.comment")}
              placeholder={t("place.leaveAComment")}
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
              aria-label={t("place.postComment")}
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
