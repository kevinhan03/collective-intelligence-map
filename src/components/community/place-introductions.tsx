"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Comment, MapPlace, Viewer } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { post } from "./api";

export function PlaceIntroductions({
  place,
  viewer,
  demo,
  readOnly,
  loginHref,
  onReport,
}: {
  place: MapPlace;
  viewer: Viewer | null;
  demo: boolean;
  readOnly: boolean;
  loginHref: string;
  onReport: (id: string) => void;
}) {
  const [entries, setEntries] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const publicPlace = ["approved", "disputed"].includes(place.status);
  const enabled = Boolean(viewer) && !demo && !readOnly && publicPlace;
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/map-places/${place.id}/introductions`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("소개를 불러오지 못했습니다.");
        return response.json();
      })
      .then((data) => {
        setEntries(data.introductions);
        setLoadError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [place.id, demo, revision]);

  function reset() {
    setOpen(false);
    setEditing(null);
    setText("");
    setError("");
  }
  return (
    <section
      className="rounded-xl bg-secondary/60 p-5 space-y-4"
      aria-label="장소 소개"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">장소 소개</h3>
        {enabled && !open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            소개 추가하기
          </Button>
        )}
      </div>
      {place.rationale && (
        <article>
          <p className="whitespace-pre-wrap text-sm leading-7">
            {place.rationale}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {place.added_by ? (
              <Link href={`/u/${place.handle}`}>@{place.handle}</Link>
            ) : (
              place.handle
            )}{" "}
            · 등록자의 소개
          </p>
        </article>
      )}
      {entries.map((entry) => (
        <article key={entry.id} className="border-t pt-3">
          <p className="whitespace-pre-wrap text-sm leading-7">{entry.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {entry.author_id ? (
              <Link href={`/u/${entry.handle}`}>@{entry.handle}</Link>
            ) : (
              <span>{entry.handle}</span>
            )}
            {enabled && entry.author_id === viewer?.id && (
              <>
                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing(entry.id);
                    setText(entry.body);
                    setError("");
                    setOpen(true);
                  }}
                >
                  수정
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (submitting.current) return;
                    submitting.current = true;
                    setBusy(true);
                    setError("");
                    try {
                      await post("/api/community", {
                        action: "delete_comment",
                        id: entry.id,
                      });
                      setEntries((items) =>
                        items.filter((item) => item.id !== entry.id),
                      );
                      if (editing === entry.id) reset();
                    } catch (error) {
                      setError((error as Error).message);
                    } finally {
                      submitting.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  삭제
                </button>
              </>
            )}
            {enabled && (
              <button disabled={busy} onClick={() => onReport(entry.id)}>
                신고
              </button>
            )}
          </div>
        </article>
      ))}
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          소개를 불러오는 중…
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-xs text-destructive">
          {loadError}{" "}
          <button
            onClick={() => setRevision((value) => value + 1)}
            className="underline"
          >
            다시 불러오기
          </button>
        </p>
      )}
      {!loading && !loadError && !place.rationale && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          아직 소개가 없어요. 이 장소의 첫 소개를 남겨 주세요.
        </p>
      )}
      {!open && !readOnly && !demo && publicPlace && (
        <p className="text-xs text-muted-foreground">
          {viewer ? (
            "등록자가 아니어도 이 장소의 특징과 추천하는 점을 소개할 수 있어요."
          ) : (
            <Link href={loginHref} className="text-primary underline">
              로그인하고 소개 추가하기
            </Link>
          )}
        </p>
      )}
      {!readOnly && !demo && !publicPlace && (
        <p className="text-xs text-muted-foreground">
          장소가 공개되면 누구나 소개를 추가할 수 있어요.
        </p>
      )}
      {open && enabled && (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            setBusy(true);
            setError("");
            try {
              await post(`/api/map-places/${place.id}/introductions`, {
                body: text,
                ...(editing ? { id: editing } : {}),
              });
              reset();
              setRevision((value) => value + 1);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          <label htmlFor={`introduction-${place.id}`} className="text-sm">
            {editing ? "내 소개 수정" : "장소 소개 추가"}
          </label>
          <Textarea
            id={`introduction-${place.id}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            minLength={2}
            maxLength={1000}
            required
            disabled={busy}
            placeholder="이 장소의 특징이나 추천하는 점을 알려 주세요."
          />
          <p className="text-xs text-muted-foreground">
            2~1,000자 · 다른 사람의 소개와 함께 표시됩니다.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy}>
              {busy ? "저장 중…" : "소개 저장"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={reset}
            >
              취소
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
