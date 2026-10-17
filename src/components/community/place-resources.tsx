"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  PlaceResourceCache,
  emptyResourceSnapshot,
} from "./place-resource-cache";
const Context = createContext<PlaceResourceCache | null>(null);
export function PlaceResources({
  identity,
  children,
}: {
  identity: string;
  children: ReactNode;
}) {
  const cache = useMemo(() => new PlaceResourceCache(identity), [identity]);
  useEffect(() => () => cache.dispose(), [cache]);
  return <Context.Provider value={cache}>{children}</Context.Provider>;
}
export function usePlaceResource<T>(
  key: string,
  enabled: boolean,
  fetcher: (signal: AbortSignal) => Promise<T>,
) {
  const shared = useContext(Context);
  const own = useMemo(() => new PlaceResourceCache(), []);
  const cache = shared ?? own;
  useEffect(() => () => own.dispose(), [own]);
  const subscribe = useCallback(
    (notify: () => void) => cache.subscribe(key, notify),
    [cache, key],
  );
  const getSnapshot = useCallback(() => cache.snapshot<T>(key), [cache, key]);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    emptyResourceSnapshot,
  );
  useEffect(() => {
    if (enabled) void cache.load(key, fetcher).catch(() => {});
  }, [cache, key, enabled, fetcher]);
  return {
    cache,
    ...snapshot,
    loading:
      enabled && (snapshot.loading || (!snapshot.data && !snapshot.error)),
  };
}
