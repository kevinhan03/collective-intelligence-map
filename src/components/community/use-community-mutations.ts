"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapPlace } from "@/domain/types";
import { post } from "./api";
type PersonalState = {
  votes: Record<string, number>;
  saves: string[];
  followed: boolean;
};
type Overrides = {
  identity: string;
  source: MapPlace[];
  votes: Record<string, number>;
  saves: Record<string, boolean>;
  counts: Record<string, { positive: number; negative: number }>;
  followed?: boolean;
};
export function voteCounts(
  place: Pick<MapPlace, "positive" | "negative">,
  previous: number,
  next: number,
) {
  return {
    positive: Math.max(
      0,
      place.positive - Number(previous === 1) + Number(next === 1),
    ),
    negative: Math.max(
      0,
      place.negative - Number(previous === -1) + Number(next === -1),
    ),
  };
}
export function useCommunityMutations(
  identity: string,
  source: MapPlace[],
  personal: PersonalState,
) {
  const [state, setState] = useState<Overrides | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const locks = useRef(new Set<string>());
  const current =
    state?.identity === identity && state.source === source ? state : null;
  const scope = useRef({ identity, source });
  useEffect(() => {
    scope.current = { identity, source };
  }, [identity, source]);
  const empty = useCallback(
    (): Overrides => ({ identity, source, votes: {}, saves: {}, counts: {} }),
    [identity, source],
  );
  const patch = useCallback(
    (change: (value: Overrides) => Overrides) => {
      setState((previous) =>
        change(
          previous?.identity === identity && previous.source === source
            ? previous
            : empty(),
        ),
      );
    },
    [identity, source, empty],
  );
  const isPending = useCallback(
    (action: string, id: string) => pending.has(`${identity}:${action}:${id}`),
    [pending, identity],
  );
  const mutate = useCallback(
    async (
      action: string,
      id: string,
      payload: unknown,
      apply: (value: Overrides) => Overrides,
      rollback: (value: Overrides) => Overrides,
    ) => {
      const key = `${identity}:${action}:${id}`;
      if (locks.current.has(key)) return false;
      locks.current.add(key);
      setPending((previous) => new Set(previous).add(key));
      patch(apply);
      try {
        await post("/api/community", payload);
        return true;
      } catch (error) {
        if (
          scope.current.identity === identity &&
          scope.current.source === source
        )
          patch(rollback);
        throw error;
      } finally {
        locks.current.delete(key);
        setPending((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
      }
    },
    [identity, source, patch],
  );
  const votes = useMemo(
    () => ({ ...personal.votes, ...current?.votes }),
    [personal.votes, current?.votes],
  );
  const savedIds = useMemo(() => new Set(personal.saves), [personal.saves]);
  const isSaved = useCallback(
    (id: string) => current?.saves[id] ?? savedIds.has(id),
    [current?.saves, savedIds],
  );
  const counts = current?.counts;
  const withCounts = useCallback(
    (place: MapPlace): MapPlace =>
      counts?.[place.id] ? { ...place, ...counts[place.id] } : place,
    [counts],
  );
  async function vote(place: MapPlace, value: 1 | -1) {
    const previous = votes[place.id] ?? 0;
    const next = previous === value ? 0 : value;
    const before = { positive: place.positive, negative: place.negative };
    const after = voteCounts(place, previous, next);
    return mutate(
      "vote",
      place.id,
      { action: "vote", id: place.id, value: next },
      (state) => ({
        ...state,
        votes: { ...state.votes, [place.id]: next },
        counts: { ...state.counts, [place.id]: after },
      }),
      (state) => ({
        ...state,
        votes: { ...state.votes, [place.id]: previous },
        counts: { ...state.counts, [place.id]: before },
      }),
    );
  }
  async function save(id: string) {
    const previous = isSaved(id);
    return mutate(
      "save",
      id,
      { action: "save", id, enabled: !previous },
      (state) => ({ ...state, saves: { ...state.saves, [id]: !previous } }),
      (state) => ({ ...state, saves: { ...state.saves, [id]: previous } }),
    );
  }
  const followed = current?.followed ?? personal.followed;
  async function follow(mapId: string) {
    return mutate(
      "follow",
      mapId,
      { action: "follow", id: mapId, enabled: !followed },
      (state) => ({ ...state, followed: !followed }),
      (state) => ({ ...state, followed }),
    );
  }
  return {
    votes,
    isSaved,
    withCounts,
    vote,
    save,
    follow,
    followed,
    isPending,
  };
}
