"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Comment } from "@/domain/types";

type Thread = { comments: Comment[]; total: number };
export function usePlaceComments(id: string, demo: boolean) {
  const [thread, setThread] = useState<Thread>({ comments: [], total: 0 });
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(
    async (offset = 0) => {
      if (demo) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/map-places/${id}/comments?offset=${offset}`,
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("댓글을 불러오지 못했어요.");
        const data: Thread = await response.json();
        if (controller.signal.aborted) return;
        setThread((previous) => ({
          total: data.total ?? data.comments.length,
          comments: offset
            ? [
                ...previous.comments,
                ...data.comments.filter(
                  (c) => !previous.comments.some((p) => p.id === c.id),
                ),
              ]
            : data.comments,
        }));
      } catch (error) {
        if (!controller.signal.aborted) setError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [id, demo],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [load]);
  return {
    ...thread,
    loading,
    error,
    reload: load,
    setThread,
    hasMore: thread.comments.length < thread.total,
  };
}
