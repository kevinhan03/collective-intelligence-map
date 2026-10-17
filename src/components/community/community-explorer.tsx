"use client";
import type { PlaceSheetStage } from "@/hooks/use-place-sheet-drag";
import { useCommunityMutations } from "./use-community-mutations";
import dynamic from "next/dynamic";
import { Suspense, lazy } from "react";
import { PlacePanel } from "./place-panel";
import { PlaceResources } from "./place-resources";
import { ShareButton } from "./share-button";
import { placePath } from "@/domain/seo";
import type { Coordinate } from "@/domain/visit";
import { formatDistance } from "@/domain/visit";
import { useMapSearch } from "@/hooks/use-map-search";
import {
  localMapSearch,
  compactSearch,
  suggestionLabels,
  type SearchStation,
  type SearchSuggestion,
  type SearchPlace,
} from "@/domain/map-search";
import { useMobile } from "@/hooks/use-mobile";
import { useViewerState } from "./viewer-state";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Clock,
  Info,
  MapPin,
  List,
  LoaderCircle,
  Map as MapIcon,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapCanvas } from "@/components/map/map-canvas";
import { boundsForPlaces } from "@/domain/map-bounds";
import { CreatorMapReport } from "@/components/creator/map-report";
const PlaceDetail = lazy(() =>
  import("./place-detail").then((module) => ({ default: module.PlaceDetail })),
);
import { MobilePlaceCarousel } from "./mobile-place-carousel";
import { MobilePlacePeek } from "./mobile-place-peek";
import { MobilePlaceList } from "./mobile-place-list";
import { MobilePlaceOverview } from "./mobile-place-overview";
import { PlacePreview } from "./place-preview";
const PendingReview = dynamic(() =>
  import("./pending-review").then((module) => module.PendingReview),
);
import { trackCommunityEvent } from "@/lib/community-analytics";
import {
  isControversial,
  isNew,
  isVerified,
  sortPlaces,
} from "@/domain/relevance";
import { formatLocation } from "@/domain/location";
import { placeArea, placeCity } from "@/domain/place-location";
import { loginHref } from "@/domain/login-return";
import type {
  RailStation,
  Bounds,
  MapPlace,
  RendererConfig,
  Sort,
  ThemeMap,
  Viewer,
} from "@/domain/types";
const sortOptions: { value: Sort; label: string }[] = [
  { value: "relevance", label: "추천순" },
  { value: "distance", label: "가까운 순" },
  { value: "newest", label: "최근 추가순" },
];
type ExplorerProps = {
  map: ThemeMap;
  initialPlaces: MapPlace[];
  pendingPlaces: MapPlace[];
  viewer: Viewer | null;
  config: RendererConfig;
  myState: {
    votes: Record<string, number>;
    saves: string[];
    followed: boolean;
  };
  demo: boolean;
  readOnly?: boolean;
};
export function CommunityExplorer(props: ExplorerProps) {
  const personalized = useViewerState();
  const identity = `${props.map.id}:${personalized.viewer?.id ?? props.viewer?.id ?? "anonymous"}`;
  return (
    <PlaceResources identity={identity}>
      <ExplorerContent {...props} />
    </PlaceResources>
  );
}
function ExplorerContent({
  map,
  initialPlaces,
  pendingPlaces,
  viewer: initialViewer,
  config,
  myState: initialMyState,
  demo,
  readOnly = false,
}: ExplorerProps) {
  const mobile = useMobile();
  const [pinHintOpen, setPinHintOpen] = useState(true);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [stationFocus, setStationFocus] = useState<{
    station: RailStation;
    place: Coordinate;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const locationRequest = useRef(0);
  function locate(nextSort?: Sort) {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 위치 확인을 지원하지 않아요.");
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setRestoreBounds(null);
        setStationFocus(null);
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        if (nextSort) {
          setSort(nextSort);
          setPage(1);
        }
      },
      () => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setError(
          "위치를 확인하지 못했어요. 위치 권한을 확인한 뒤 내 위치 버튼으로 다시 시도해 주세요.",
        );
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }
  function changeSort(value: Sort) {
    if (value === "distance" && !userLocation) {
      locate(value);
      return;
    }
    setSort(value);
    setPage(1);
  }
  function selectStation(station: RailStation, place: MapPlace) {
    setSearchSelection(null);
    setStationFocus({ station, place: { lat: place.lat, lng: place.lng } });
    setDetailId(null);
    if (mobile) {
      setSheetStage("summary");
      changeView("map");
    }
  }

  const [mobileView, setMobileView] = useState<"list" | "map">("map");
  const listScroll = useRef(0);
  const [listElement, setListElement] = useState<HTMLElement | null>(null);
  const [hasMorePlacesBelow, setHasMorePlacesBelow] = useState(false);
  useEffect(() => {
    if (!listElement || mobile) return;
    const update = () =>
      setHasMorePlacesBelow(
        listElement.scrollHeight -
          listElement.clientHeight -
          listElement.scrollTop >
          4,
      );
    const resize = new ResizeObserver(update);
    const observe = () => {
      resize.disconnect();
      resize.observe(listElement);
      for (const child of listElement.children) resize.observe(child);
      update();
    };
    const mutation = new MutationObserver(observe);
    mutation.observe(listElement, { childList: true });
    listElement.addEventListener("scroll", update, { passive: true });
    const frame = requestAnimationFrame(observe);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      listElement.removeEventListener("scroll", update);
    };
  }, [listElement, mobile]);
  const changeView = useCallback(
    (view: "list" | "map", fromProgress?: string) => {
      if (mobileView === "list") listScroll.current = window.scrollY;
      if (view !== mobileView && explorerRoot.current) {
        explorerRoot.current.style.setProperty(
          "--view-start",
          fromProgress ?? (mobileView === "list" ? "100%" : "0%"),
        );
        explorerRoot.current.dataset.viewTransition = view;
      }
      setMobileView(view);
      if (view === "list")
        requestAnimationFrame(() =>
          window.scrollTo({ top: listScroll.current, behavior: "instant" }),
        );
    },
    [mobileView],
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const explorerRoot = useRef<HTMLElement>(null);
  const viewSwipe = useRef<{
    id: number;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const suppressViewClick = useRef(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const element = explorerRoot.current;
      if (!element) return;
      element.style.setProperty(
        "--map-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      element.style.setProperty(
        "--map-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);
  const searchToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  const [failedSaveId, setFailedSaveId] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const infoTrigger = useRef<HTMLButtonElement>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sheetStage, setSheetStage] = useState<PlaceSheetStage>("collapsed");
  const browsingSheetStage = useRef<"collapsed" | "summary">("collapsed");
  const placeTrigger = useRef<HTMLElement | null>(null);
  function changeSheetStage(stage: PlaceSheetStage) {
    setSheetStage(stage);
    if (stage === "collapsed" || stage === "summary")
      browsingSheetStage.current = stage;
  }
  function closeSheet() {
    setSearchSelection(null);
    setRestoreBounds(viewport);
    setSheetStage("closed");
    browsingSheetStage.current = "summary";
    if (detailId) setPreviewId(detailId);
    setDetailId(null);
    setSelected(null);
    setStationFocus(null);
    setSearchStationHighlighted(false);
    requestAnimationFrame(() => {
      const handle = explorerRoot.current?.querySelector<HTMLElement>(
        ".mobile-place-peek .place-sheet-handle",
      );
      if (handle) handle.focus({ preventScroll: true });
      else if (placeTrigger.current?.isConnected)
        placeTrigger.current.focus({ preventScroll: true });
      else
        explorerRoot.current
          ?.querySelector<HTMLElement>(".explorer-toolbar button")
          ?.focus({ preventScroll: true });
    });
  }
  function collapseDetail() {
    setSearchSelection(null);
    setDetailId(null);
    const next = mobileView === "map" ? "summary" : browsingSheetStage.current;
    setSheetStage(next);
    browsingSheetStage.current = next;
    if (mobileView === "map" && selected) setPreviewId(selected);
    requestAnimationFrame(() => {
      const handle = explorerRoot.current?.querySelector<HTMLElement>(
        ".mobile-place-carousel .place-sheet-handle",
      );
      if (mobileView === "map" && handle) handle.focus({ preventScroll: true });
      else if (placeTrigger.current?.isConnected)
        placeTrigger.current.focus({ preventScroll: true });
    });
  }
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<{
    id: string;
    name: string;
    enabled: boolean;
  } | null>(null);
  const personalized = useViewerState();
  const viewer = personalized.viewer ?? initialViewer;
  const myState = personalized.viewer ? personalized.myState : initialMyState;
  const actions = useCommunityMutations(
    `${map.id}:${viewer?.id ?? "anonymous"}`,
    initialPlaces,
    myState,
  );
  const followerCount = Math.max(
    0,
    map.follower_count + Number(actions.followed) - Number(myState.followed),
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPlaceId = searchParams.get("place");
  const requestedProposalId = searchParams.get("proposal");
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState<Sort>("relevance"),
    [selected, setSelected] = useState<string | null>(null),
    [detailId, setDetailId] = useState<string | null>(null),
    [commentsEntryId, setCommentsEntryId] = useState<string | null>(null),
    [focusRequest, setFocusRequest] = useState(0),
    [viewport, setViewport] = useState<Bounds | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [showPending, setShowPending] = useState(false);
  const [searchStation, setSearchStation] = useState<SearchStation | null>(
    null,
  );
  const [searchStationHighlighted, setSearchStationHighlighted] =
    useState(false);
  const [composing, setComposing] = useState(false);
  const [searchSelection, setSearchSelection] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [openedSearchPlace, setOpenedSearchPlace] = useState<MapPlace | null>(
    null,
  );
  const [restoreBounds, setRestoreBounds] = useState<Bounds | null>(null);
  const browsingBounds = useRef<Bounds | null>(null);
  const wasSearching = useRef(false);
  const hasInitialViewport = useRef(false);
  const openedPlaceId = useRef<string | null>(null);
  const searchTracked = useRef(false);
  const places = useMemo(() => initialPlaces.slice(0, 500), [initialPlaces]);
  const truncated = initialPlaces.length > 500;
  const deferredQuery = useDeferredValue(query);
  const searchArgs = useMemo(
    () => ({
      q: deferredQuery,
      stationId: searchStation?.id,
      region,
      sort,
      offset: 0,
      lat: sort === "distance" ? userLocation?.lat : undefined,
      lng: sort === "distance" ? userLocation?.lng : undefined,
    }),
    [
      deferredQuery,
      searchStation?.id,
      region,
      sort,
      userLocation?.lat,
      userLocation?.lng,
    ],
  );
  const search = useMapSearch(map.id, searchArgs, places, composing, !readOnly);
  const saveBrowsingBounds = useEffectEvent(() => {
    browsingBounds.current = viewport;
  });
  useEffect(() => {
    if (search.active && !wasSearching.current) saveBrowsingBounds();
    if (!search.active && wasSearching.current) {
      const timer = setTimeout(() => {
        setRestoreBounds(browsingBounds.current);
        setStationFocus(null);
        setPreviewId(null);
        setSelected(null);
      }, 0);
      wasSearching.current = false;
      return () => clearTimeout(timer);
    }
    wasSearching.current = search.active;
  }, [search.active]);
  const initialBounds = useMemo(
    () => boundsForPlaces(initialPlaces.slice(0, 500), map.bounds),
    [initialPlaces, map.bounds],
  );
  const isSaved = actions.isSaved;
  const localSearch = useMemo(
    () => localMapSearch(places, searchArgs),
    [places, searchArgs],
  );
  const unpatchedFiltered = useMemo(
    () =>
      search.active
        ? (search.result?.items ??
          (search.error ? search.previous?.items : null) ??
          localSearch.items)
        : sortPlaces(
            places.filter(
              (p) => !mobile || !region || placeCity(p.address) === region,
            ),
            sort,
            userLocation ?? undefined,
          ).sort((a, b) =>
            map.kind === "creator" && sort === "relevance"
              ? (a.position ?? 0) - (b.position ?? 0) ||
                a.id.localeCompare(b.id)
              : 0,
          ),
    [
      search.active,
      search.result,
      search.error,
      search.previous,
      places,
      localSearch,
      mobile,
      region,
      sort,
      userLocation,
      map.kind,
    ],
  );
  const filtered = useMemo(
    () => unpatchedFiltered.map(actions.withCounts),
    [unpatchedFiltered, actions.withCounts],
  );
  const displayPending = useMemo(
    () => pendingPlaces.map(actions.withCounts),
    [pendingPlaces, actions.withCounts],
  );
  const mapPlaces = useMemo(
    () => [...filtered, ...(search.active ? [] : displayPending)],
    [filtered, search.active, displayPending],
  );
  const regions = useMemo(
    () =>
      [...new Set(places.map((p) => placeCity(p.address)))].sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [places],
  );
  // No place is preselected: the sheet lists every place until one is picked.
  const activePreviewId =
    sheetStage !== "closed" && filtered.some((p) => p.id === previewId)
      ? previewId
      : null;
  const mobileBounds = useMemo(
    () =>
      boundsForPlaces(
        region || !activePreviewId
          ? filtered
          : filtered.filter((p) => p.id === activePreviewId),
        map.bounds,
      ),
    [region, filtered, activePreviewId, map.bounds],
  );
  useEffect(() => {
    if (!mobile || detailId || sheetStage === "closed") return;
    const timer = window.setTimeout(() => {
      setPreviewId(activePreviewId);
      setSelected(activePreviewId);
      if (activePreviewId && activePreviewId !== previewId && !region)
        setFocusRequest((request) => request + 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mobile, activePreviewId, detailId, previewId, region, sheetStage]);
  const selectPreview = (id: string) => {
    setSearchSelection(null);
    if (mobile && searchSelection) {
      setSearchOpen(false);
      searchInput.current?.blur();
    }
    changeSheetStage("summary");
    setRestoreBounds(null);
    setSearchStationHighlighted(false);
    setOpenedSearchPlace(filtered.find((p) => p.id === id) ?? null);
    setStationFocus(null);
    setSelected(id);
    setPreviewId(id);
    setFocusRequest((request) => request + 1);
  };
  const listStation =
    searchStation && search.result?.station?.id === searchStation.id
      ? {
          name: searchStation.name,
          distance: (place: MapPlace) =>
            (place as SearchPlace).station_distance_m != null
              ? formatDistance((place as SearchPlace).station_distance_m!)
              : null,
        }
      : undefined;
  const visiblePlaces = useMemo(
    () => (search.active ? filtered : filtered.slice(0, page * 20)),
    [filtered, page, search.active],
  );
  const searchSuggestions =
    search.result?.suggestions ?? localSearch.suggestions;
  const resultCount = search.active
    ? (search.result?.total ?? filtered.length)
    : filtered.length;
  function clearSearch() {
    setSearchSelection(null);
    setQuery("");
    setSearchStation(null);
    setSuggestOpen(false);
    setPage(1);
  }
  function chooseSuggestion(suggestion: SearchSuggestion) {
    setSearchSelection(suggestion.kind === "place" ? suggestion.term : null);
    if (suggestion.station) {
      setSearchStation(suggestion.station);
      setSearchStationHighlighted(true);
      setQuery("");
    } else setQuery(suggestion.term);
    setSuggestOpen(false);
    setSuggestIndex(-1);
    setPage(1);
    searchInput.current?.focus();
  }
  const onBoundsChange = useCallback((b: Bounds) => {
    if (!hasInitialViewport.current) {
      hasInitialViewport.current = true;
      return;
    }
    setViewport((current) => {
      if (
        current &&
        Math.abs(current.north - b.north) < 0.000001 &&
        Math.abs(current.east - b.east) < 0.000001 &&
        Math.abs(current.south - b.south) < 0.000001 &&
        Math.abs(current.west - b.west) < 0.000001
      ) {
        return current;
      }
      return b;
    });
  }, []);
  const selectedPlaceBase =
    [
      ...filtered,
      ...places,
      ...pendingPlaces,
      ...(openedSearchPlace ? [openedSearchPlace] : []),
    ].find((p) => p.id === detailId) ?? null;
  const selectedPlace = selectedPlaceBase
    ? actions.withCounts(selectedPlaceBase)
    : null;
  const previewPlaceBase =
    [...filtered, ...places, ...pendingPlaces].find(
      (p) => p.id === previewId,
    ) ?? null;
  const previewPlace = previewPlaceBase
    ? actions.withCounts(previewPlaceBase)
    : null;
  const toggleFollow = async () => {
    if (readOnly) return;
    if (!viewer) {
      router.push(loginHref(`/maps/${map.slug}`));
      return;
    }
    setError("");
    try {
      await actions.follow(map.id);
    } catch (error) {
      setError((error as Error).message);
    }
  };
  const votePlace = async (id: string, value: 1 | -1) => {
    if (demo || readOnly || map.kind === "creator") return;
    const place = [...filtered, ...places, ...pendingPlaces].find(
      (place) => place.id === id,
    );
    if (!place) return;
    setError("");
    try {
      await actions.vote(actions.withCounts(place), value);
    } catch (error) {
      setError((error as Error).message);
    }
  };
  const savePlace = async (id: string, undo = false) => {
    if (demo || readOnly) return;
    if (!viewer) {
      const place = places.find((item) => item.id === id);
      router.push(
        loginHref(
          `/maps/${map.slug}${place ? `?place=${encodeURIComponent(place.place_id)}` : ""}`,
        ),
      );
      return;
    }
    const enabled = !isSaved(id);
    setError("");
    setFailedSaveId(null);
    try {
      if (!(await actions.save(id))) return;
      setSaveNotice(
        undo || mobile
          ? null
          : {
              id,
              name: places.find((place) => place.id === id)?.name ?? "장소",
              enabled,
            },
      );
    } catch (error) {
      setError((error as Error).message);
      setFailedSaveId(id);
    }
  };
  const focusPlace = useCallback(
    (id: string) => {
      // Manual selection supersedes an autocomplete request that is still loading.
      setSearchSelection(null);
      placeTrigger.current = document.activeElement as HTMLElement | null;
      if (mobile) {
        if (searchSelection) {
          setSearchOpen(false);
          searchInput.current?.blur();
        }
        changeSheetStage("summary");
      }
      setRestoreBounds(null);
      setSearchStationHighlighted(false);
      setOpenedSearchPlace(filtered.find((p) => p.id === id) ?? null);
      setStationFocus(null);
      setSelected(id);
      if (mobile) {
        if (mobileView === "map") {
          setDetailId(null);
          setPreviewId(id);
          setFocusRequest((request) => request + 1);
          trackCommunityEvent("place_preview_opened", {
            entry: "map_pin",
            provider: config.provider,
          });
          return;
        }
        changeView("map");
        setDetailId(null);
        setPreviewId(id);
        setFocusRequest((request) => request + 1);
        trackCommunityEvent("place_preview_opened", {
          entry: "list",
          provider: config.provider,
        });
        return;
      }
      if (config.provider === "preview") {
        setDetailId(id);
        return;
      }
      setDetailId((current) => (current ? id : null));
      setFocusRequest((request) => request + 1);
    },
    [
      config.provider,
      mobile,
      mobileView,
      filtered,
      changeView,
      searchSelection,
    ],
  );
  const selectMapPlace = useCallback(
    (id: string) => {
      if (pendingPlaces.some((place) => place.id === id)) {
        setSelected(id);
        setShowPending(true);
      } else focusPlace(id);
    },
    [pendingPlaces, focusPlace],
  );
  const completeMapFocus = useCallback(
    (id: string) => {
      if (!mobile) setDetailId(id);
    },
    [mobile],
  );
  const changeMapView = useRef(changeView);
  useEffect(() => {
    changeMapView.current = changeView;
  }, [changeView]);
  const mapFallback = useCallback(() => changeMapView.current("list"), []);
  const mapStationFocus = useMemo(
    () =>
      stationFocus ??
      (searchStation && searchStationHighlighted
        ? {
            station: { ...searchStation, distance_m: 0 },
            place: filtered[0] ?? searchStation,
          }
        : null),
    [stationFocus, searchStation, searchStationHighlighted, filtered],
  );
  const mapBounds = useMemo(
    () =>
      search.active
        ? boundsForPlaces(
            [...filtered, ...(searchStation ? [searchStation] : [])],
            map.bounds,
          )
        : (restoreBounds ?? (mobile ? mobileBounds : initialBounds)),
    [
      search.active,
      filtered,
      searchStation,
      map.bounds,
      restoreBounds,
      mobile,
      mobileBounds,
      initialBounds,
    ],
  );
  const openSearchSelection = useEffectEvent((id: string) => {
    setSearchSelection(null);
    if (mobile) {
      changeView("map");
      setDetailId(null);
      selectPreview(id);
      setSearchOpen(false);
      searchInput.current?.blur();
    } else focusPlace(id);
  });
  useEffect(() => {
    if (
      !searchSelection ||
      search.loading ||
      composing ||
      deferredQuery !== query
    )
      return;
    if (compactSearch(query) !== compactSearch(searchSelection)) return;
    const exact = filtered.filter(
      (place) => compactSearch(place.name) === compactSearch(searchSelection),
    );
    const target = exact[0] ?? (filtered.length === 1 ? filtered[0] : null);
    if (!target) return;
    const frame = requestAnimationFrame(() => openSearchSelection(target.id));
    return () => cancelAnimationFrame(frame);
  }, [
    searchSelection,
    search.loading,
    composing,
    query,
    deferredQuery,
    filtered,
  ]);
  useEffect(() => {
    const requestKey = requestedProposalId ?? requestedPlaceId;
    if (!requestKey || openedPlaceId.current === requestKey) return;
    const mapPlace = [...places, ...pendingPlaces].find((place) =>
      requestedProposalId
        ? place.id === requestedProposalId
        : place.place_id === requestedPlaceId,
    );
    if (!mapPlace) return;
    const timer = window.setTimeout(() => {
      openedPlaceId.current = requestKey;
      setSelected(mapPlace.id);
      setFocusRequest((request) => request + 1);
      setPreviewId(mapPlace.id);
      changeSheetStage("detail");
      setDetailId(mapPlace.id);
      trackCommunityEvent("place_detail_opened", {
        entry: "deep_link",
        provider: config.provider,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    config.provider,
    pendingPlaces,
    places,
    requestedPlaceId,
    requestedProposalId,
  ]);
  const emptyMap = map.place_count === 0 && places.length === 0;
  const hasSearchFilters = Boolean(query.trim() || searchStation || region);
  const canSuggestPlace = map.kind !== "creator" && !readOnly && !demo;
  const emptyState = (
    <>
      <h2 role="status" className="font-medium">
        {emptyMap ? "아직 등록된 장소가 없어요." : "조건에 맞는 장소가 없어요."}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        {emptyMap
          ? map.kind === "creator"
            ? "크리에이터가 장소를 추가하면 이 지도에서 볼 수 있어요."
            : canSuggestPlace
              ? "이 주제에 어울리는 첫 장소를 제안해 주세요."
              : "장소가 추가되면 이 지도에서 볼 수 있어요."
          : "검색어나 지역 필터를 바꿔서 다시 찾아보세요."}
      </p>
      {!emptyMap && hasSearchFilters && (
        <Button
          variant="outline"
          onClick={() => {
            clearSearch();
            setRegion("");
          }}
        >
          검색 조건 초기화
        </Button>
      )}
      {emptyMap && canSuggestPlace && (
        <Button asChild>
          <Link href={`/maps/${map.slug}/submit`} prefetch={false}>
            <Plus size={15} aria-hidden="true" /> 첫 장소 제안하기
          </Link>
        </Button>
      )}
      {emptyMap && map.kind === "creator" && !readOnly && (
        <Button asChild variant="outline">
          <Link href={`/u/${map.creator_handle ?? ""}`} prefetch={false}>
            크리에이터 프로필
          </Link>
        </Button>
      )}
    </>
  );
  const mobileControls = (
    <div className="mobile-view-controls lg:hidden">
      <div
        className="visit-view-switch"
        role="group"
        aria-label="장소 보기 방식"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          viewSwipe.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            width: event.currentTarget.clientWidth / 2,
          };
          suppressViewClick.current = false;
          if (explorerRoot.current)
            explorerRoot.current.removeAttribute("data-view-transition");
          const target = event.target as HTMLElement;
          (target.closest("button") ?? event.currentTarget).setPointerCapture(
            event.pointerId,
          );
        }}
        onPointerMove={(event) => {
          const origin = viewSwipe.current;
          if (!origin || origin.id !== event.pointerId) return;
          const dx = event.clientX - origin.x;
          const dy = event.clientY - origin.y;
          if (Math.abs(dx) < 5 || Math.abs(dx) <= Math.abs(dy)) return;
          event.currentTarget.setAttribute("data-view-dragging", "true");
          const progress = Math.max(
            0,
            Math.min(1, (mobileView === "list" ? 1 : 0) + dx / origin.width),
          );
          explorerRoot.current?.style.setProperty(
            "--view-progress",
            `${progress * 100}%`,
          );
        }}
        onPointerUp={(event) => {
          const fromProgress =
            explorerRoot.current?.style.getPropertyValue("--view-progress") ||
            undefined;
          event.currentTarget.removeAttribute("data-view-dragging");
          explorerRoot.current?.style.removeProperty("--view-progress");
          const origin = viewSwipe.current;
          viewSwipe.current = null;
          if (!origin || origin.id !== event.pointerId) return;
          const dx = event.clientX - origin.x;
          const dy = event.clientY - origin.y;
          if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
          suppressViewClick.current = true;
          const view = dx > 0 ? "list" : "map";
          if (view !== mobileView) {
            changeView(view, fromProgress);
            trackCommunityEvent("community_view_changed", {
              provider: config.provider,
              view,
            });
          }
        }}
        onPointerCancel={(event) => {
          event.currentTarget.removeAttribute("data-view-dragging");
          explorerRoot.current?.style.removeProperty("--view-progress");
          viewSwipe.current = null;
        }}
        onClickCapture={(event) => {
          if (suppressViewClick.current && event.detail !== 0) {
            event.preventDefault();
            event.stopPropagation();
            suppressViewClick.current = false;
          }
        }}
      >
        {(["map", "list"] as const).map((view) => (
          <button
            key={view}
            type="button"
            aria-label={view === "map" ? "지도 보기" : "목록 보기"}
            aria-pressed={mobileView === view}
            aria-controls={view === "map" ? "explorer-map" : "explorer-list"}
            onClick={() => {
              changeView(view);
              trackCommunityEvent("community_view_changed", {
                provider: config.provider,
                view,
              });
            }}
          >
            {view === "map" ? (
              <MapIcon size={16} aria-hidden="true" />
            ) : (
              <List size={16} aria-hidden="true" />
            )}
            <span>{view === "map" ? "지도" : "목록"}</span>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <main
      ref={explorerRoot}
      id="main"
      className="community-explorer mx-auto max-w-[1440px]"
      data-mobile-view={mobileView}
    >
      <div
        className="map-hero border-b px-5 py-3 md:px-9"
        data-mobile-view={mobileView}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="map-hero-heading min-w-0">
            <Link
              href="/"
              prefetch={false}
              className="map-home-back lg:hidden"
              aria-label="홈으로 돌아가기"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </Link>
            <Link
              href="/"
              prefetch={false}
              className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <ArrowLeft size={13} />
              발견
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {mobile ? (
                  <button
                    ref={infoTrigger}
                    className="map-title-button"
                    aria-label={`${map.title} 지도 정보 보기`}
                    onClick={() => setInfoOpen(true)}
                  >
                    {map.title}
                  </button>
                ) : (
                  map.title
                )}
              </h1>
              <span className="kicker">{formatLocation(map)}</span>
            </div>
            <p className="map-hero-description mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {map.description}
            </p>
          </div>
          <Button
            ref={searchToggle}
            className="map-info-trigger lg:hidden"
            variant="ghost"
            size="icon"
            aria-label="장소 검색 열기"
            onClick={() => {
              setSearchOpen((open) => !open);
            }}
          >
            <Search size={19} />
          </Button>
          <div className="map-hero-actions flex gap-2">
            <Button
              variant="outline"
              aria-label={`${map.title} 지도 정보 보기`}
              onClick={() => setInfoOpen(true)}
            >
              <Info size={14} /> 지도 정보
            </Button>
            <Button
              variant={actions.followed ? "secondary" : "outline"}
              disabled={actions.isPending("follow", map.id) || readOnly}
              onClick={toggleFollow}
            >
              {actions.followed ? <Check size={14} /> : <Plus size={14} />}{" "}
              {actions.followed ? "팔로우 중" : "팔로우"}
            </Button>
            <Button asChild>
              <Link
                href={
                  map.kind === "creator"
                    ? `/u/${map.creator_handle ?? ""}`
                    : `/maps/${map.slug}/submit`
                }
                prefetch={false}
              >
                <Plus size={15} />
                {map.kind === "creator" ? "크리에이터 프로필" : "장소 제안"}
              </Link>
            </Button>
          </div>
        </div>
        <div className="map-hero-meta mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex gap-1.5">
            <MapPin size={13} />
            {map.place_count} 장소
          </span>
          <span className="flex gap-1.5">
            <Users size={13} />
            {followerCount} 팔로워
          </span>
          <span>{map.contributor_count} 기여자</span>
          <a
            href={`/maps/${map.slug}/places`}
            className="text-primary hover:underline"
          >
            공개 장소 목록
          </a>
          <details className="ml-auto max-w-lg">
            <summary className="cursor-pointer">커뮤니티 규칙 보기</summary>
            <p className="pt-3 leading-6">{map.rules}</p>
          </details>
        </div>
        {readOnly && (
          <p role="status" className="mt-3 text-sm text-primary">
            초안 미리보기 · 저장과 참여 기능은 비활성화됩니다.
          </p>
        )}
        {map.creator_handle && (
          <Link
            className="mt-2 inline-block text-sm text-primary"
            href={`/u/${map.creator_handle}`}
          >
            @{map.creator_handle}의 지도
          </Link>
        )}
        {demo && (
          <p className="map-hero-demo mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Info size={13} />
            미리보기 · 가상 장소이며 실제 추천·검증 정보가 아닙니다.
          </p>
        )}
      </div>
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent
          className="map-info-sheet top-auto bottom-0 max-w-none translate-y-0 rounded-b-none p-0 sm:max-w-none"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            infoTrigger.current?.focus();
          }}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted-foreground/40" />
          <DialogHeader className="gap-3 px-5 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">{map.title}</DialogTitle>
                <DialogDescription className="mt-1 text-xs">
                  {formatLocation(map)}
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" aria-label="지도 정보 닫기">
                  <ArrowLeft className="rotate-180" size={18} />
                </Button>
              </DialogClose>
            </div>
            {!readOnly && (
              <ShareButton path={`/maps/${map.slug}`} title={map.title} />
            )}
            {map.kind === "creator" && !readOnly && (
              <CreatorMapReport
                mapId={map.id}
                admin={viewer?.role === "admin"}
              />
            )}
            <a
              href={`/maps/${map.slug}/places`}
              className="text-sm text-primary underline"
            >
              공개 장소 목록 보기
            </a>
            <DialogDescription className="text-sm leading-6">
              {map.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 pt-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {map.place_count} 장소
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {followerCount} 팔로워
            </span>
            <span>{map.contributor_count} 기여자</span>
          </div>
          <details className="mx-5 mt-5 border-t py-4 text-sm">
            <summary className="cursor-pointer font-medium">
              커뮤니티 규칙 보기
            </summary>
            <p className="pt-3 leading-6 text-muted-foreground">{map.rules}</p>
          </details>
          <div className="grid grid-cols-2 gap-2 border-t p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
            <Button
              variant={actions.followed ? "secondary" : "outline"}
              disabled={actions.isPending("follow", map.id) || readOnly}
              onClick={toggleFollow}
            >
              {actions.followed ? <Check size={15} /> : <Plus size={15} />}
              {actions.followed ? "팔로우 중" : "팔로우"}
            </Button>
            <Button asChild>
              <Link
                href={
                  map.kind === "creator"
                    ? `/u/${map.creator_handle ?? ""}`
                    : `/maps/${map.slug}/submit`
                }
                prefetch={false}
              >
                <Plus size={15} />
                {map.kind === "creator" ? "크리에이터 프로필" : "장소 제안"}
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Link
        href={
          map.kind === "creator"
            ? `/u/${map.creator_handle ?? ""}`
            : `/maps/${map.slug}/submit`
        }
        prefetch={false}
        className={`mobile-propose-floating lg:hidden ${map.kind === "creator" || readOnly ? "!hidden" : ""}`}
        aria-label="장소 제안"
      >
        <Plus size={22} aria-hidden="true" />
      </Link>
      {mobileView === "list" && !detailId && (
        <div className="mobile-explorer-actions lg:hidden">
          {mobileControls}
        </div>
      )}
      <div
        data-search-open={searchOpen}
        className="glass-toolbar explorer-toolbar flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 md:px-9"
      >
        <div className="search-sort-group flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="map-search-field relative w-full sm:w-60">
            <Search
              className="map-search-icon absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              size="1em"
              aria-hidden="true"
            />
            <Input
              ref={searchInput}
              className="h-9 bg-background pl-9 pr-10 text-xs"
              value={query}
              maxLength={100}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestOpen && searchSuggestions.length > 0}
              aria-controls={
                suggestOpen && searchSuggestions.length > 0
                  ? "map-search-suggestions"
                  : undefined
              }
              aria-activedescendant={
                suggestOpen &&
                suggestIndex >= 0 &&
                suggestIndex < searchSuggestions.length
                  ? `map-search-option-${suggestIndex}`
                  : undefined
              }
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setSuggestOpen(false)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || composing) return;
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setSuggestOpen(false);
                  setSuggestIndex(-1);
                } else if (
                  event.key === "ArrowDown" ||
                  event.key === "ArrowUp"
                ) {
                  event.preventDefault();
                  setSuggestOpen(true);
                  setSuggestIndex((i) =>
                    searchSuggestions.length
                      ? i < 0
                        ? event.key === "ArrowDown"
                          ? 0
                          : searchSuggestions.length - 1
                        : (i +
                            (event.key === "ArrowDown" ? 1 : -1) +
                            searchSuggestions.length) %
                          searchSuggestions.length
                      : -1,
                  );
                } else if (
                  event.key === "Enter" &&
                  !composing &&
                  !event.nativeEvent.isComposing &&
                  suggestOpen &&
                  searchSuggestions[suggestIndex]
                ) {
                  event.preventDefault();
                  chooseSuggestion(searchSuggestions[suggestIndex]);
                } else if (
                  event.key === "Enter" &&
                  !composing &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  setSuggestOpen(false);
                  setSearchSelection(query);
                }
              }}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                setSearchSelection(null);
                setSuggestOpen(true);
                setSuggestIndex(-1);
                setPage(1);
                if (value.trim() && !searchTracked.current) {
                  searchTracked.current = true;
                  trackCommunityEvent("place_search_started", {
                    provider: config.provider,
                  });
                }
              }}
              placeholder="장소·지역·분류·역 검색"
              aria-label="이 맵의 장소 검색"
            />
            {search.active && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={clearSearch}
                aria-label="검색·역 필터 초기화"
              >
                <X size={14} />
              </Button>
            )}
            {suggestOpen && searchSuggestions.length > 0 && (
              <div
                className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 overflow-hidden rounded-xl border bg-card p-1 shadow-lg"
                role="listbox"
                id="map-search-suggestions"
                aria-label="관련 검색어"
              >
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.kind}:${suggestion.station?.id ?? suggestion.term}`}
                    id={`map-search-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={suggestIndex === index}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-secondary"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      chooseSuggestion(suggestion);
                      trackCommunityEvent("place_search_suggestion_selected", {
                        provider: config.provider,
                      });
                    }}
                  >
                    <span>{suggestion.term}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {suggestion.station
                        ? `${suggestion.station.kind === "subway" ? "지하철" : "기차역"} · ${suggestion.station.region === "seoul" ? "서울" : suggestion.station.region === "tokyo" ? "도쿄" : suggestion.station.region}`
                        : suggestionLabels[suggestion.kind]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            className="sort-chip-group hidden lg:flex shrink-0 items-center gap-1 overflow-x-auto"
            role="group"
            aria-label="장소 정렬"
          >
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="sort-chip"
                aria-pressed={sort === option.value}
                onClick={() => {
                  changeSort(option.value);
                  trackCommunityEvent("place_sort_changed", {
                    provider: config.provider,
                    sort: option.value,
                  });
                }}
              >
                {map.kind === "creator" && option.value === "relevance"
                  ? "크리에이터 순"
                  : search.active && option.value === "relevance"
                    ? "검색 일치순"
                    : option.label}
              </button>
            ))}
          </div>
        </div>
        <details
          className="mobile-map-filter-menu lg:hidden"
          open={mobileView === "list" ? true : undefined}
        >
          <summary>
            필터{region || sort !== "relevance" ? " · 적용 중" : ""}
          </summary>
          <div className="mobile-explorer-filters">
            <select
              aria-label="장소 지역"
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
                setRestoreBounds(null);
                setPage(1);
                setPreviewId(null);
                setSelected(null);
              }}
            >
              <option value="">전체 지역</option>
              {regions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              aria-label="장소 정렬"
              value={sort}
              onChange={(event) => {
                changeSort(event.target.value as Sort);
                setPage(1);
                setPreviewId(null);
                trackCommunityEvent("place_sort_changed", {
                  provider: config.provider,
                  sort: event.target.value as Sort,
                });
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {map.kind === "creator" && option.value === "relevance"
                    ? "크리에이터 순"
                    : option.value === "relevance"
                      ? search.active
                        ? "검색 일치순"
                        : option.label
                      : option.label}
                </option>
              ))}
            </select>
          </div>
        </details>
        <button
          className="mobile-search-close lg:hidden"
          aria-label="장소 검색 닫기"
          onClick={() => {
            setSearchOpen(false);
            searchToggle.current?.focus();
          }}
        >
          <X size={18} />
        </button>
        {pendingPlaces.length > 0 && (
          <Button
            size="sm"
            variant={showPending ? "default" : "outline"}
            className="h-8 shrink-0 rounded-full px-3 text-xs"
            onClick={() => setShowPending((v) => !v)}
          >
            <Clock size={12} />
            승인대기 {pendingPlaces.length}
          </Button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="bg-destructive/5 px-6 py-3 text-sm text-destructive"
        >
          {error}
          {failedSaveId && (
            <button
              className="ml-3 underline"
              disabled={actions.isPending("save", failedSaveId)}
              onClick={() => void savePlace(failedSaveId)}
            >
              저장 다시 시도
            </button>
          )}
        </p>
      )}
      {saveNotice && !mobile && (
        <div
          role="status"
          className="save-notice fixed right-4 bottom-5 z-50 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xl"
        >
          <span>
            {saveNotice.name}{" "}
            {saveNotice.enabled ? "저장했어요." : "저장 해제했어요."}
          </span>
          <button
            type="button"
            className="font-semibold text-primary underline"
            disabled={actions.isPending("save", saveNotice.id)}
            onClick={() => void savePlace(saveNotice.id, true)}
          >
            실행 취소
          </button>
          <button
            type="button"
            aria-label="알림 닫기"
            onClick={() => setSaveNotice(null)}
          >
            ×
          </button>
        </div>
      )}
      {showPending && pendingPlaces.length > 0 && (
        <PendingReview
          places={displayPending}
          viewer={viewer}
          votes={actions.votes}
          demo={demo}
          onVote={votePlace}
          isPending={(id) => actions.isPending("vote", id)}
        />
      )}
      {search.active && (
        <div
          className="flex flex-wrap items-center gap-2 border-b px-5 py-2 text-xs"
          aria-live="polite"
        >
          {searchStation && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchStation(null)}
              aria-label="역 필터 해제"
            >
              {searchStation.name} 주변 2km <X size={12} />
            </Button>
          )}
          <span>
            {search.error
              ? "검색 실패 · 이전 결과 표시"
              : search.loading
                ? "지도 전체 검색 중…"
                : search.result?.mode === "local"
                  ? "현재 불러온 장소 내 검색"
                  : "지도 전체 공개 장소 검색"}
          </span>
          {searchStation && <span>역 반경은 직선거리 기준입니다.</span>}
          {search.result?.stationsStatus !== "ready" && !search.loading && (
            <span>
              {search.result?.stationsStatus === "unsupported"
                ? "이 지역은 역 검색을 지원하지 않습니다."
                : "역 검색 데이터 준비 중"}
            </span>
          )}
          {search.error && (
            <>
              <span role="alert" className="text-destructive">
                {search.error}
              </span>
              <Button variant="outline" size="sm" onClick={search.retry}>
                검색 재시도
              </Button>
            </>
          )}
        </div>
      )}
      <div
        data-mobile-view={mobileView}
        className={`glass-map-shell explorer-layout ${selectedPlace ? "has-detail" : ""}`}
      >
        <section
          id="explorer-list"
          ref={setListElement}
          className="place-list lg:h-fit lg:max-h-[calc(100dvh-250px)] lg:min-h-[480px] lg:self-start lg:overflow-y-auto"
          aria-label="장소 목록"
        >
          <div className="place-list-heading sticky top-0 z-10 flex items-center justify-between border-b px-3 py-3">
            <span className="text-xs font-medium">
              {resultCount}개의 발견
              {resultCount > visiblePlaces.length &&
                ` · 현재 ${visiblePlaces.length}곳 표시`}
              {!search.active && truncated && " · 일부 결과"}
            </span>
          </div>
          {mobile && mobileView === "list" && (
            <MobilePlaceList
              places={visiblePlaces}
              selected={selected}
              active={!detailId}
              demo={demo}
              busy={readOnly}
              isSavePending={(id) => actions.isPending("save", id)}
              isSaved={isSaved}
              onOpen={focusPlace}
              onSave={(id) => void savePlace(id)}
              station={listStation}
            />
          )}
          {!mobile &&
            visiblePlaces.map((p, i) => {
              return (
                <article
                  key={p.id}
                  onClick={() => focusPlace(p.id)}
                  data-selected={selected === p.id}
                  className="place-glass-card group cursor-pointer p-3 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            focusPlace(p.id);
                          }}
                          className="text-left text-sm font-semibold tracking-tight hover:underline"
                        >
                          {p.name}
                        </button>
                        {!demo && isNew(p) && (
                          <span className="place-badge place-badge-new">
                            NEW
                          </span>
                        )}
                        {!demo && isControversial(p) && (
                          <span className="place-badge place-badge-controversial">
                            논쟁 중
                          </span>
                        )}
                        {!demo && isVerified(p) && (
                          <span className="place-badge place-badge-verified">
                            검증됨
                          </span>
                        )}
                      </div>
                      {(demo || placeArea(p.address)) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[demo ? "가상 예시" : null, placeArea(p.address)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {p.rationale && (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {p.rationale}
                        </p>
                      )}
                      {searchStation &&
                        search.result?.station?.id === searchStation.id &&
                        (p as SearchPlace).station_distance_m != null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {searchStation.name} · 직선거리{" "}
                            {formatDistance(
                              (p as SearchPlace).station_distance_m!,
                            )}
                          </p>
                        )}
                    </div>
                    <button
                      aria-label={`${p.name} 상세 보기`}
                      onClick={(event) => {
                        event.stopPropagation();
                        focusPlace(p.id);
                      }}
                      className="p-1 text-muted-foreground"
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="mt-2 ml-8 flex items-center justify-between">
                    <div
                      className={`place-card-votes hidden ${map.kind !== "creator" ? "lg:flex" : ""} items-center gap-1.5`}
                      aria-label={`${p.name} 주제 적합성 투표`}
                    >
                      <button
                        type="button"
                        className="vote-control"
                        aria-label={`${p.name} 테마에 잘 맞아요 ${p.positive}`}
                        aria-pressed={actions.votes[p.id] === 1}
                        disabled={
                          demo || readOnly || actions.isPending("vote", p.id)
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          void votePlace(p.id, 1);
                        }}
                      >
                        <ThumbsUp size={13} fill="none" strokeWidth={1.8} />
                        <span>{p.positive}</span>
                      </button>
                      <button
                        type="button"
                        className="vote-control"
                        aria-label={`${p.name} 테마와 달라요 ${p.negative}`}
                        aria-pressed={actions.votes[p.id] === -1}
                        disabled={
                          demo || readOnly || actions.isPending("vote", p.id)
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          void votePlace(p.id, -1);
                        }}
                      >
                        <ThumbsDown size={13} fill="none" strokeWidth={1.8} />
                        <span>{p.negative}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`${p.name} ${isSaved(p.id) ? "저장 해제" : "저장"}`}
                      aria-pressed={isSaved(p.id)}
                      disabled={
                        demo || readOnly || actions.isPending("save", p.id)
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        void savePlace(p.id);
                      }}
                      className="p-1 text-muted-foreground"
                    >
                      <Bookmark
                        size={15}
                        fill={isSaved(p.id) ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          {filtered.length === 0 && !search.loading && !search.error && (
            <div className="px-8 py-18 text-center">
              <MapPin
                className="mx-auto mb-4 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="grid justify-items-center gap-3">
                {emptyState}
              </div>
            </div>
          )}
          {(search.active
            ? search.result?.hasMore
            : filtered.length > page * 20) && (
            <Button
              variant="ghost"
              className="my-3 w-full"
              disabled={search.loading}
              onClick={() =>
                search.active ? void search.more() : setPage((p) => p + 1)
              }
            >
              더 보기
            </Button>
          )}
          {!mobile && hasMorePlacesBelow && (
            <div className="place-list-scroll-hint" aria-hidden="true">
              <span>
                아래로 스크롤해 더 보기 <ChevronDown size={14} />
              </span>
            </div>
          )}
        </section>
        <section
          id="explorer-map"
          aria-label="장소 지도"
          className="explorer-map relative min-w-0 min-h-[420px] lg:h-[calc(100dvh-250px)]"
        >
          <MapCanvas
            key={mobile ? `mobile-${region}` : "desktop"}
            onFallback={mobile ? mapFallback : undefined}
            userLocation={userLocation}
            stationFocus={mapStationFocus}
            places={mapPlaces}
            selected={mobile ? activePreviewId : selected}
            onSelect={selectMapPlace}
            onFocusComplete={completeMapFocus}
            focusRequest={focusRequest}
            bounds={mapBounds}
            onBoundsChange={onBoundsChange}
            config={config}
          />
          <Button
            variant="outline"
            className="location-button absolute top-28 right-3 z-20 shadow-lg"
            disabled={locating}
            aria-label="내 위치"
            aria-busy={locating}
            title="내 위치"
            onClick={() => locate()}
          >
            {locating ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v5M21 12h-5M12 21v-5M3 12h5" />
              </svg>
            )}
            {locating && (
              <span className="sr-only" role="status">
                위치 확인 중…
              </span>
            )}
          </Button>
          {!mobile &&
            config.provider === "maplibre" &&
            places.length > 1 &&
            pinHintOpen && (
              <div className="absolute bottom-20 left-4 z-10 rounded-full bg-card/90 px-4 py-3 text-xs text-foreground shadow-lg lg:bottom-4">
                숫자 핀을 누르면 장소를 확대할 수 있어요.
                <button
                  type="button"
                  aria-label="숫자 핀 안내 닫기"
                  onClick={() => setPinHintOpen(false)}
                  className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border bg-card text-foreground shadow-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          {mobile ? (
            filtered.length ? (
              sheetStage === "closed" ? (
                <>
                  <MobilePlacePeek
                    subject={
                      filtered.some((p) => p.id === previewId)
                        ? "장소 카드"
                        : "장소 목록"
                    }
                    onExpand={() => {
                      changeSheetStage("summary");
                      setSelected(
                        filtered.some((p) => p.id === previewId)
                          ? previewId
                          : null,
                      );
                    }}
                  />
                  <div className="mobile-closed-controls">{mobileControls}</div>
                </>
              ) : !activePreviewId ? (
                <MobilePlaceOverview
                  demo={demo}
                  busy={readOnly}
                  isSavePending={(id) => actions.isPending("save", id)}
                  stage={sheetStage === "collapsed" ? "collapsed" : "summary"}
                  onStageChange={changeSheetStage}
                  onClose={closeSheet}
                  controls={mobileControls}
                  places={filtered}
                  onOpen={(id) => {
                    selectPreview(id);
                  }}
                  onSave={(id) => void savePlace(id)}
                  isSaved={isSaved}
                  station={listStation}
                />
              ) : (
                <MobilePlaceCarousel
                  getVote={(id) => actions.votes[id] ?? 0}
                  onVote={(id) => void votePlace(id, 1)}
                  onOpenComments={(id) => {
                    setSearchSelection(null);
                    setCommentsEntryId(id);
                    changeSheetStage("detail");
                    setSelected(id);
                    setDetailId(id);
                  }}
                  creator={map.kind === "creator"}
                  demo={demo}
                  onClose={closeSheet}
                  controls={mobileControls}
                  places={filtered}
                  activeId={activePreviewId}
                  onSelect={selectPreview}
                  onOpen={(id) => {
                    setSearchSelection(null);
                    setCommentsEntryId(null);
                    changeSheetStage("detail");
                    setSelected(id);
                    setDetailId(id);
                  }}
                  onSave={(id) => void savePlace(id)}
                  isSaved={isSaved}
                  disabled={demo || readOnly}
                  votePending={actions.isPending("vote", activePreviewId ?? "")}
                  savePending={actions.isPending("save", activePreviewId ?? "")}
                />
              )
            ) : (
              <div className="mobile-map-empty">
                {!search.loading && !search.error && emptyState}
                <div className="mobile-explorer-actions">{mobileControls}</div>
              </div>
            )
          ) : previewPlace ? (
            <PlacePreview
              creator={map.kind === "creator"}
              onStationSelect={(station) =>
                selectStation(station, previewPlace)
              }
              place={previewPlace}
              loginHref={loginHref(
                `/maps/${map.slug}?place=${encodeURIComponent(previewPlace.place_id)}`,
              )}
              saved={isSaved(previewPlace.id)}
              vote={actions.votes[previewPlace.id] ?? 0}
              demo={demo}
              votePending={actions.isPending("vote", previewPlace.id)}
              savePending={actions.isPending("save", previewPlace.id)}
              signedIn={Boolean(viewer)}
              busy={readOnly}
              onClose={() => {
                setPreviewId(null);
                setSelected(null);
              }}
              onOpenDetail={() => {
                setPreviewId(null);
                setDetailId(previewPlace.id);
                trackCommunityEvent("place_detail_opened", {
                  entry: "map_preview",
                  provider: config.provider,
                });
              }}
              onVote={(value) => votePlace(previewPlace.id, value)}
              onSave={() => void savePlace(previewPlace.id)}
            />
          ) : (
            <>
              <Link
                href={
                  map.kind === "creator"
                    ? `/u/${map.creator_handle ?? ""}`
                    : `/maps/${map.slug}/submit`
                }
                prefetch={false}
                className="absolute right-4 bottom-16 z-10 hidden min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg max-lg:inline-flex"
              >
                <Plus size={16} aria-hidden="true" />
                {map.kind === "creator" ? "크리에이터 프로필" : "장소 제안"}
              </Link>
            </>
          )}
        </section>
        {selectedPlace && (
          <Suspense
            fallback={
              <PlacePanel
                title="장소 정보 불러오는 중"
                onClose={mobile ? collapseDetail : () => setDetailId(null)}
              >
                <aside
                  className="place-detail-panel"
                  aria-label="장소 정보 불러오는 중"
                >
                  <div className="place-detail-heading flex items-center justify-between">
                    <h2>{selectedPlace.name}</h2>
                    <button
                      type="button"
                      className="detail-icon-action"
                      aria-label="장소 상세 닫기"
                      onClick={mobile ? closeSheet : () => setDetailId(null)}
                    >
                      <X size={21} />
                    </button>
                  </div>
                  <p
                    role="status"
                    className="p-5 text-sm text-muted-foreground"
                  >
                    장소를 불러오는 중…
                  </p>
                </aside>
              </PlacePanel>
            }
          >
            <PlaceDetail
              initialComments={
                commentsEntryId === detailId && Boolean(detailId)
              }
              mapTitle={map.title}
              readOnly={readOnly}
              creator={map.kind === "creator"}
              userLocation={userLocation}
              key={`${detailId ?? "closed"}:${commentsEntryId === detailId ? "comments" : "detail"}`}
              sharePath={
                selectedPlace
                  ? placePath(map.slug, selectedPlace.place_id)
                  : `/maps/${map.slug}`
              }
              onStationSelect={(station) => {
                if (selectedPlace) selectStation(station, selectedPlace);
              }}
              place={selectedPlace}
              loginHref={loginHref(
                `/maps/${map.slug}${selectedPlace ? `?place=${encodeURIComponent(selectedPlace.place_id)}` : ""}`,
              )}
              onClose={mobile ? closeSheet : () => setDetailId(null)}
              onCollapse={mobile ? collapseDetail : () => setDetailId(null)}
              onViewMap={
                mobile
                  ? () => {
                      if (!selectedPlace) return;
                      changeView("map");
                      setDetailId(null);
                      changeSheetStage("summary");
                      selectPreview(selectedPlace.id);
                      setSearchOpen(false);
                      requestAnimationFrame(() =>
                        explorerRoot.current
                          ?.querySelector<HTMLButtonElement>(
                            ".mobile-place-carousel .place-sheet-handle",
                          )
                          ?.focus({ preventScroll: true }),
                      );
                    }
                  : undefined
              }
              viewer={viewer}
              vote={actions.votes[detailId ?? ""] ?? 0}
              saved={isSaved(detailId ?? "")}
              demo={demo}
              onVote={(value) => votePlace(selectedPlace.id, value)}
              onSave={() => savePlace(selectedPlace.id)}
              votePending={actions.isPending("vote", selectedPlace.id)}
              savePending={actions.isPending("save", selectedPlace.id)}
              onChange={() => router.refresh()}
            />
          </Suspense>
        )}
      </div>
    </main>
  );
}
