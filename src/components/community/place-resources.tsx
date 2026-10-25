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
import { photoImageUrl, type PhotoPage } from "@/domain/place-photo";
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

/** Start only the selected place's two useful thumbnails while the map moves. */
export function usePrefetchPlacePhotos() {
  const cache = useContext(Context);
  return useCallback(
    (placeId: string) => {
      if (!cache) return;
      void cache
        .load<PhotoPage>(`photos:${placeId}`, async (signal) => {
          const response = await fetch(`/api/places/${placeId}/photos`, {
            signal,
          });
          if (!response.ok) throw new Error("사진을 불러오지 못했습니다.");
          const page: PhotoPage = await response.json();
          if (!signal.aborted) {
            const ids = new Set([page.backdropPhotoId, page.photos[0]?.id]);
            for (const id of ids) {
              if (!id) continue;
              const image = new window.Image();
              image.decoding = "async";
              image.fetchPriority = "high";
              image.src = photoImageUrl(id, true);
            }
          }
          return page;
        })
        .catch(() => {});
    },
    [cache],
  );
}
