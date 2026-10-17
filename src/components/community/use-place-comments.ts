"use client";
import { useCallback, type SetStateAction } from "react";
import type { Comment } from "@/domain/types";
import { usePlaceResource } from "./place-resources";
type Thread = { comments: Comment[]; total: number };
const empty: Thread = { comments: [], total: 0 };
export function usePlaceComments(id: string, demo: boolean) {
  const key = `comments:${id}`;
  const fetchPage = useCallback(
    async (signal: AbortSignal, offset = 0): Promise<Thread> => {
      const response = await fetch(
        `/api/map-places/${id}/comments?offset=${offset}`,
        { signal },
      );
      if (!response.ok) throw new Error("댓글을 불러오지 못했어요.");
      const data: Thread = await response.json();
      return {
        comments: data.comments,
        total: data.total ?? data.comments.length,
      };
    },
    [id],
  );
  const { cache, data, loading, error } = usePlaceResource(
    key,
    !demo && Boolean(id),
    fetchPage,
  );
  const reload = useCallback(
    async (offset = 0) => {
      if (demo || !id) return;
      await cache
        .load<Thread>(key, (signal) => fetchPage(signal, offset), {
          force: true,
          merge: offset
            ? (previous, incoming) => {
                const ids = new Set(
                  previous?.comments.map((comment) => comment.id),
                );
                return {
                  total: incoming.total,
                  comments: [
                    ...(previous?.comments ?? []),
                    ...incoming.comments.filter(
                      (comment) => !ids.has(comment.id),
                    ),
                  ],
                };
              }
            : undefined,
        })
        .catch(() => {});
    },
    [cache, key, demo, id, fetchPage],
  );
  const setThread = useCallback(
    (change: SetStateAction<Thread>) => {
      cache.update<Thread>(key, (previous) =>
        typeof change === "function" ? change(previous ?? empty) : change,
      );
    },
    [cache, key],
  );
  const thread = demo ? empty : (data ?? empty);
  return {
    ...thread,
    loading,
    error,
    reload,
    setThread,
    hasMore: thread.comments.length < thread.total,
  };
}
