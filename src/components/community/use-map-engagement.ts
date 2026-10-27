"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMobile } from "@/hooks/use-mobile";
import { loginHref } from "@/domain/login-return";
import type { ThemeMap } from "@/domain/types";
type Personal = {
  viewerId: string | null;
  saved: string[];
  hyped: string[];
  hypeCreatedAt: Record<string, string>;
};
type Counts = {
  hype_count?: number;
  hype_week_count?: number;
  saved_count?: number;
};
const empty: Personal = {
  viewerId: null,
  saved: [],
  hyped: [],
  hypeCreatedAt: {},
};
export function useMapEngagement(maps: ThemeMap[], demo: boolean) {
  const router = useRouter();
  const mobile = useMobile();
  const [personal, setPersonal] = useState<Personal>(empty);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [ready, setReady] = useState(demo);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const locks = useRef(new Set<string>());
  const revision = useRef(0);
  const actor = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const startedAt = revision.current;
    try {
      const response = await fetch("/api/maps/engagement", {
        signal: request.signal,
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("지도 반응 정보를 불러오지 못했습니다.");
      const value: Personal = await response.json();
      if (request.signal.aborted || revision.current !== startedAt) return;
      if (actor.current !== value.viewerId) setCounts({});
      actor.current = value.viewerId;
      setPersonal(value);
      setReady(true);
      setError("");
    } catch (cause) {
      if (!request.signal.aborted) setError((cause as Error).message);
    }
  }, []);
  useEffect(() => {
    if (demo || mobile) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [demo, mobile, load]);
  const withCounts = (map: ThemeMap) => ({ ...map, ...counts[map.id] });
  const isSaved = (id: string) => personal.saved.includes(id);
  const isHyped = (id: string) => personal.hyped.includes(id);
  async function toggle(action: "hype" | "save_map", id: string) {
    if (!ready || demo) return;
    if (!personal.viewerId) {
      router.push(loginHref("/"));
      return;
    }
    const key = `${action}:${id}`;
    if (locks.current.has(key)) return;
    const map = maps.find((item) => item.id === id);
    if (!map) return;
    const user = personal.viewerId;
    const kind = action === "hype" ? "hyped" : "saved";
    const previous = personal[kind].includes(id),
      enabled = !previous;
    const before = counts[id] ?? {};
    const delta = enabled ? 1 : -1;
    const current = withCounts(map);
    const recent =
      !personal.hypeCreatedAt[id] ||
      Date.parse(personal.hypeCreatedAt[id]) >= Date.now() - 7 * 86400000;
    const optimistic: Counts =
      action === "hype"
        ? {
            ...before,
            hype_count: Math.max(0, (current.hype_count ?? 0) + delta),
            hype_week_count: Math.max(
              0,
              (current.hype_week_count ?? 0) + (recent ? delta : 0),
            ),
          }
        : {
            ...before,
            saved_count: Math.max(
              0,
              (current.saved_count ?? map.follower_count) + delta,
            ),
          };
    locks.current.add(key);
    revision.current++;
    setPending((value) => [...value, key]);
    setError("");
    setPersonal((value) => ({
      ...value,
      [kind]: enabled
        ? [...value[kind], id]
        : value[kind].filter((item) => item !== id),
    }));
    // Patch only this action's count so independent save/hype responses commute.
    const patch =
      action === "hype"
        ? {
            hype_count: optimistic.hype_count,
            hype_week_count: optimistic.hype_week_count,
          }
        : { saved_count: optimistic.saved_count };
    setCounts((value) => ({ ...value, [id]: { ...value[id], ...patch } }));
    try {
      const response = await fetch("/api/maps/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, enabled }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "지도 반응을 저장하지 못했습니다.");
      if (actor.current !== user) return;
      const authoritative =
        action === "hype"
          ? {
              hype_count: result.hype_count,
              hype_week_count: result.hype_week_count,
            }
          : typeof result.saved_count === "number"
            ? { saved_count: result.saved_count }
            : patch;
      setCounts((value) => ({
        ...value,
        [id]: { ...value[id], ...authoritative },
      }));
    } catch (cause) {
      if (actor.current !== user) return;
      setPersonal((value) => ({
        ...value,
        [kind]: previous
          ? [...new Set([...value[kind], id])]
          : value[kind].filter((item) => item !== id),
      }));
      const rollback =
        action === "hype"
          ? {
              hype_count: current.hype_count ?? 0,
              hype_week_count: current.hype_week_count ?? 0,
            }
          : { saved_count: current.saved_count ?? map.follower_count };
      setCounts((value) => ({ ...value, [id]: { ...value[id], ...rollback } }));
      setError((cause as Error).message);
    } finally {
      locks.current.delete(key);
      setPending((value) => value.filter((item) => item !== key));
    }
  }
  return {
    withCounts,
    isSaved,
    isHyped,
    toggle,
    ready,
    error,
    reload: load,
    isPending: (action: string, id: string) =>
      pending.includes(`${action}:${id}`),
  };
}
