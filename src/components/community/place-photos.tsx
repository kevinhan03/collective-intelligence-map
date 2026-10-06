"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PHOTO_SOURCE_LIMIT,
  PHOTO_TYPES,
  photoImageUrl,
  type PhotoPage,
  type PlacePhoto,
} from "@/domain/place-photo";
import type { Viewer } from "@/domain/types";
import { preparePhoto } from "./photo-upload";
import { post } from "./api";
type PendingPhoto = {
  id: string;
  file: File;
  preview: string;
  caption: string;
  state: "waiting" | "uploading" | "done" | "failed";
  error?: string;
};
export function PlacePhotos({
  placeId,
  viewer,
  loginHref,
  demo,
}: {
  placeId: string;
  viewer: Viewer | null;
  loginHref: string;
  demo: boolean;
}) {
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"upload" | "view" | null>(null);
  const [selected, setSelected] = useState(0);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const previews = useRef(new Set<string>());
  const lifetime = useRef<AbortController | null>(null);
  const uploadLock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const urls = previews.current;
    if (!demo) {
      fetch(`/api/places/${placeId}/photos`, { signal: controller.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error("사진을 불러오지 못했습니다.");
          return r.json() as Promise<PhotoPage>;
        })
        .then((page) => {
          setPhotos(page.photos);
          setCursor(page.nextCursor);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    return () => {
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [placeId, demo]);
  const reload = useCallback(
    async (next?: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/places/${placeId}/photos${next ? `?cursor=${encodeURIComponent(next)}` : ""}`,
          { signal: lifetime.current?.signal },
        );
        if (!response.ok) throw new Error("사진을 불러오지 못했습니다.");
        const page: PhotoPage = await response.json();
        setPhotos((old) =>
          next
            ? [
                ...old,
                ...page.photos.filter((p) => !old.some((x) => x.id === p.id)),
              ]
            : page.photos,
        );
        setCursor(page.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [placeId],
  );
  function open(nextMode: "view" | "upload", element: HTMLElement, index = 0) {
    opener.current = element;
    setSelected(index);
    setMode(nextMode);
    setReporting(false);
    setError("");
  }
  function selectFiles(files: FileList | null) {
    if (!files) return;
    if (files.length + pending.length > 5) {
      setError("한 번에 최대 5장을 선택할 수 있습니다.");
      return;
    }
    const invalid = Array.from(files).find(
      (f) => !PHOTO_TYPES.includes(f.type) || f.size > PHOTO_SOURCE_LIMIT,
    );
    if (invalid) {
      setError("5MB 이하 JPG, PNG, WebP 파일을 선택해 주세요.");
      return;
    }
    setError("");
    setPending((old) => [
      ...old,
      ...Array.from(files).map((file) => {
        const preview = URL.createObjectURL(file);
        previews.current.add(preview);
        return {
          id: crypto.randomUUID(),
          file,
          preview,
          caption: "",
          state: "waiting" as const,
        };
      }),
    ]);
  }
  async function upload() {
    if (uploadLock.current) return;
    uploadLock.current = true;
    setBusy(true);
    setError("");
    let failed = false;
    try {
      for (const item of pending.filter((p) => p.state !== "done")) {
        if (lifetime.current?.signal.aborted) break;
        setPending((old) =>
          old.map((p) =>
            p.id === item.id
              ? { ...p, state: "uploading", error: undefined }
              : p,
          ),
        );
        try {
          const blob = await preparePhoto(item.file);
          const form = new FormData();
          form.set("uploadId", item.id);
          form.set("caption", item.caption);
          form.set("photo", blob, "photo.jpg");
          const response = await fetch(`/api/places/${placeId}/photos`, {
            method: "POST",
            body: form,
            signal: lifetime.current?.signal,
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error ?? "사진을 등록하지 못했습니다.");
          setPending((old) =>
            old.map((p) => (p.id === item.id ? { ...p, state: "done" } : p)),
          );
        } catch (e) {
          failed = true;
          if (!lifetime.current?.signal.aborted)
            setPending((old) =>
              old.map((p) =>
                p.id === item.id
                  ? { ...p, state: "failed", error: (e as Error).message }
                  : p,
              ),
            );
        }
      }
      if (!lifetime.current?.signal.aborted) {
        try {
          await reload();
        } catch {
          setError(
            "등록 결과를 불러오지 못했습니다. 사진 목록을 새로고침해 주세요.",
          );
        }
        if (!failed) {
          setMode(null);
          setPending([]);
          previews.current.forEach((url) => URL.revokeObjectURL(url));
          previews.current.clear();
        }
      }
    } finally {
      uploadLock.current = false;
      setBusy(false);
    }
  }
  const photo = photos[selected];
  return (
    <section aria-label="방문자 사진" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Camera size={16} />
          방문자 사진
        </h3>
        {!viewer && !demo ? (
          <Button asChild size="sm" variant="outline">
            <Link href={loginHref}>사진 추가</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={demo}
            onClick={(e) => open("upload", e.currentTarget)}
          >
            사진 추가
          </Button>
        )}
      </div>
      {loading && !photos.length ? (
        <p role="status" className="text-sm text-muted-foreground">
          사진을 불러오는 중…
        </p>
      ) : (
        !photos.length && (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {demo
              ? "가상 예시에서는 사진을 등록할 수 없습니다."
              : "이 장소의 첫 사진을 올려 주세요."}
          </p>
        )
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p, index) => (
          <button
            key={p.id}
            className="relative h-28 w-36 shrink-0 overflow-hidden rounded-lg border focus-visible:outline-2"
            aria-label={`사진 ${index + 1} 확대: ${p.caption || "방문자 사진"}`}
            onClick={(e) => open("view", e.currentTarget, index)}
          >
            <Image
              unoptimized
              src={photoImageUrl(p.id, true)}
              loading={index === 0 ? "eager" : "lazy"}
              alt={p.caption || "방문자 사진"}
              fill
              sizes="144px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
      {cursor && (
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => {
            setError("");
            reload(cursor).catch((e) => setError(e.message));
          }}
        >
          사진 더 보기
        </Button>
      )}
      {error && !mode && (
        <div role="alert" className="text-sm text-destructive">
          {error}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setError("");
              reload().catch((e) => setError(e.message));
            }}
          >
            다시 불러오기
          </Button>
        </div>
      )}
      <Dialog.Root
        open={mode !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setMode(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/65" />
          <Dialog.Content
            data-photo-dialog
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-[100] max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-card p-5 outline-none"
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!busy) setMode(null);
            }}
            onPointerDownOutside={(e) => {
              if (busy) e.preventDefault();
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              opener.current?.focus({ preventScroll: true });
            }}
            onKeyDown={(e) => {
              if (mode === "view" && !reporting) {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSelected((i) => Math.max(0, i - 1));
                }
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setSelected((i) => Math.min(photos.length - 1, i + 1));
                }
              }
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="font-semibold">
                {mode === "upload" ? "장소 사진 등록" : "방문자 사진"}
              </Dialog.Title>
              <Button
                variant="ghost"
                size="icon"
                aria-label="사진 창 닫기"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                <X size={18} />
              </Button>
            </div>
            {mode === "upload" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  직접 촬영한 장소 사진을 올려 주세요. JPG·PNG·WebP, 장당 5MB
                  이하, 최대 5장.
                </p>
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-medium">
                  사진 선택
                  <input
                    type="file"
                    accept={PHOTO_TYPES.join(",")}
                    multiple
                    disabled={busy || pending.length >= 5}
                    className="sr-only"
                    onChange={(e) => {
                      selectFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {pending.map((item) => (
                  <article
                    key={item.id}
                    className="space-y-2 rounded-lg border p-3"
                  >
                    <div className="flex items-start gap-3">
                      <Image
                        unoptimized
                        src={item.preview}
                        width={88}
                        height={88}
                        alt={item.file.name}
                        className="h-22 w-22 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs">{item.file.name}</p>
                        <p role="status" className="mt-2 text-xs">
                          {
                            {
                              waiting: "등록 대기",
                              uploading: "등록 중…",
                              done: "등록 완료",
                              failed: "등록 실패",
                            }[item.state]
                          }
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || item.state === "done"}
                        onClick={() => {
                          URL.revokeObjectURL(item.preview);
                          previews.current.delete(item.preview);
                          setPending((old) =>
                            old.filter((p) => p.id !== item.id),
                          );
                        }}
                      >
                        제외
                      </Button>
                    </div>
                    <Textarea
                      aria-label={`${item.file.name} 사진 설명`}
                      placeholder="사진 설명 (선택)"
                      maxLength={300}
                      value={item.caption}
                      disabled={busy || item.state === "done"}
                      onChange={(e) =>
                        setPending((old) =>
                          old.map((p) =>
                            p.id === item.id
                              ? { ...p, caption: e.target.value }
                              : p,
                          ),
                        )
                      }
                    />
                    {item.error && (
                      <p role="alert" className="text-xs text-destructive">
                        {item.error}
                      </p>
                    )}
                  </article>
                ))}
                <Button
                  disabled={busy || !pending.some((p) => p.state !== "done")}
                  onClick={upload}
                >
                  {busy
                    ? "사진 등록 중…"
                    : pending.some((p) => p.state === "failed")
                      ? "실패한 사진 다시 등록"
                      : "사진 등록"}
                </Button>
              </div>
            )}
            {mode === "view" && photo && (
              <div className="space-y-3">
                <Image
                  unoptimized
                  src={photoImageUrl(photo.id)}
                  alt={photo.caption || "방문자가 등록한 장소 사진"}
                  width={photo.width}
                  height={photo.height}
                  className="max-h-[55dvh] w-full rounded-lg object-contain"
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={selected === 0}
                    aria-label="이전 사진"
                    onClick={() => {
                      setReporting(false);
                      setSelected((i) => i - 1);
                    }}
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="text-xs">
                    {selected + 1} / {photos.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={selected >= photos.length - 1}
                    aria-label="다음 사진"
                    onClick={() => {
                      setReporting(false);
                      setSelected((i) => i + 1);
                    }}
                  >
                    <ChevronRight />
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm">{photo.caption}</p>
                <p className="text-xs text-muted-foreground">
                  {photo.author_id ? (
                    <Link href={`/u/${photo.handle}`}>@{photo.handle}</Link>
                  ) : (
                    photo.handle
                  )}{" "}
                  ·{" "}
                  {new Date(photo.created_at).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </p>
                {viewer && !demo && (
                  <div className="flex gap-2">
                    {viewer.id === photo.author_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await post("/api/community", {
                              action: "delete_photo",
                              id: photo.id,
                            });
                            setPhotos((old) =>
                              old.filter((p) => p.id !== photo.id),
                            );
                            setMode(null);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        삭제
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setReporting((v) => !v);
                        setReason("");
                      }}
                    >
                      신고
                    </Button>
                  </div>
                )}
                {reporting && (
                  <form
                    className="space-y-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setError("");
                      try {
                        await post("/api/community", {
                          action: "report",
                          target: "photo",
                          id: photo.id,
                          reason,
                        });
                        setReporting(false);
                        setReason("");
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Textarea
                      aria-label="사진 신고 사유"
                      placeholder="신고 사유를 구체적으로 알려 주세요."
                      minLength={5}
                      maxLength={1000}
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Button size="sm" disabled={busy}>
                      신고 접수
                    </Button>
                  </form>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
