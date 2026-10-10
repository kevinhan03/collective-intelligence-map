"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  localMapSearch,
  normalizeSearch,
  type MapSearchInput,
  type MapSearchResult,
} from "@/domain/map-search";
import type { MapPlace } from "@/domain/types";

export function useMapSearch(
  mapId: string,
  input: MapSearchInput,
  places: MapPlace[],
  composing: boolean,
) {
  const active = Boolean(normalizeSearch(input.q) || input.stationId);
  const key = JSON.stringify([
    mapId,
    input.q,
    input.stationId,
    input.region,
    input.sort,
    input.lat,
    input.lng,
  ]);
  const [state, setState] = useState<{
    key: string;
    data: MapSearchResult;
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const moreBusy = useRef(false);
  const local = useEffectEvent((args: MapSearchInput) =>
    localMapSearch(places, args),
  );
  async function fetchResults(args: MapSearchInput, signal: AbortSignal) {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(args))
      if (value !== undefined) params.set(name, String(value));
    const response = await fetch(`/api/maps/${mapId}/search?${params}`, {
      signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
    return data as MapSearchResult;
  }
  const run = useEffectEvent(async () => {
    const id = ++sequence.current;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    moreBusy.current = false;
    setPendingKey(key);
    setError(null);
    try {
      const data = await fetchResults({ ...input, offset: 0 }, abort.signal);
      if (id !== sequence.current || abort.signal.aborted) return;
      setState({
        key,
        data: data.mode === "local" ? local({ ...input, offset: 0 }) : data,
      });
    } catch (e) {
      if (id === sequence.current && !abort.signal.aborted)
        setError({ key, message: (e as Error).message });
    } finally {
      if (id === sequence.current) setPendingKey(null);
    }
  });
  useEffect(() => {
    controller.current?.abort();
    sequence.current++;
    moreBusy.current = false;
    if (!active || composing) return;
    const timer = setTimeout(() => void run(), 400);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
    };
  }, [key, active, composing, revision]);
  async function more() {
    if (moreBusy.current || !state || state.key !== key || !state.data.hasMore)
      return;
    moreBusy.current = true;
    const id = ++sequence.current;
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setPendingKey(key);
    setError(null);
    try {
      const args = { ...input, offset: state.data.items.length };
      const data =
        state.data.mode === "local"
          ? localMapSearch(places, args)
          : await fetchResults(args, abort.signal);
      if (id !== sequence.current || abort.signal.aborted) return;
      if (data.mode !== state.data.mode) {
        setRevision((r) => r + 1);
        return;
      }
      setState({
        key,
        data: {
          ...data,
          items: [
            ...state.data.items,
            ...data.items.filter(
              (item) => !state.data.items.some((p) => p.id === item.id),
            ),
          ],
        },
      });
    } catch (e) {
      if (id === sequence.current && !abort.signal.aborted)
        setError({ key, message: (e as Error).message });
    } finally {
      if (id === sequence.current) {
        setPendingKey(null);
        moreBusy.current = false;
      }
    }
  }
  const current = active && state?.key === key ? state.data : null;
  return {
    active,
    result: current,
    previous: state?.data ?? null,
    loading:
      active &&
      !composing &&
      (pendingKey === key || (!current && error?.key !== key)),
    error: active && error?.key === key ? error.message : "",
    more,
    retry: () => setRevision((r) => r + 1),
  };
}
