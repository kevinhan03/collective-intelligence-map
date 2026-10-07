"use client";
import { ShareButton } from "./share-button";
import type { Coordinate } from "@/domain/visit";
import { useMobile } from "@/hooks/use-mobile";
import { useViewerState } from "./viewer-state";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  Clock,
  Info,
  MapPin,
  List,
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
import { PlaceDetail } from "./place-detail";
import { MobilePlaceCarousel } from "./mobile-place-carousel";
import { PlacePreview } from "./place-preview";
import { PendingReview } from "./pending-review";
import { post } from "./api";
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
  { value: "distance", label: "가까운 순" },
  { value: "relevance", label: "추천순" },
  { value: "newest", label: "최신순" },
  { value: "controversial", label: "논쟁중" },
  { value: "verified", label: "최근 확인순" },
  { value: "popular", label: "추천 많은 순" },
];
export function CommunityExplorer({
  map,
  initialPlaces,
  pendingPlaces,
  viewer: initialViewer,
  config,
  myState: initialMyState,
  demo,
}: {
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
}) {
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
    setStationFocus({ station, place: { lat: place.lat, lng: place.lng } });
    setDetailId(null);
    if (mobile) changeView("map");
  }

  const [mobileView, setMobileView] = useState<"list" | "map">("map");
  const listScroll = useRef(0);
  function changeView(view: "list" | "map") {
    if (mobileView === "list") listScroll.current = window.scrollY;
    setMobileView(view);
    if (view === "list")
      requestAnimationFrame(() =>
        window.scrollTo({ top: listScroll.current, behavior: "instant" }),
      );
  }
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const explorerRoot = useRef<HTMLElement>(null);
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
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [saveNotice, setSaveNotice] = useState<{
    id: string;
    name: string;
    enabled: boolean;
  } | null>(null);
  const personalized = useViewerState();
  const viewer = personalized.viewer ?? initialViewer;
  const myState = personalized.viewer ? personalized.myState : initialMyState;
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPlaceId = searchParams.get("place");
  const requestedProposalId = searchParams.get("proposal");
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState<Sort>("relevance"),
    [selected, setSelected] = useState<string | null>(null),
    [detailId, setDetailId] = useState<string | null>(null),
    [focusRequest, setFocusRequest] = useState(0),
    [viewport, setViewport] = useState<Bounds | null>(null),
    [loaded, setLoaded] = useState<MapPlace[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [truncated, setTruncated] = useState(initialPlaces.length > 500),
    [page, setPage] = useState(1),
    [showPending, setShowPending] = useState(false);
  const latest = useRef(0);
  const hasInitialViewport = useRef(false);
  const openedPlaceId = useRef<string | null>(null);
  const searchTracked = useRef(false);
  const places = useMemo(
    () => loaded ?? initialPlaces.slice(0, 500),
    [initialPlaces, loaded],
  );
  const initialBounds = useMemo(
    () => boundsForPlaces(initialPlaces.slice(0, 500), map.bounds),
    [initialPlaces, map.bounds],
  );
  const isSaved = (id: string) =>
    savedOverrides[id] ?? myState.saves.includes(id);
  const filtered = useMemo(
    () =>
      sortPlaces(
        places.filter(
          (p) =>
            (!mobile || !region || placeCity(p.address) === region) &&
            `${p.name} ${p.category} ${p.rationale} ${p.address} ${placeArea(p.address)}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        ),
        sort,
        userLocation ?? undefined,
      ),
    [places, query, sort, region, mobile, userLocation],
  );
  const regions = useMemo(
    () =>
      [...new Set(places.map((p) => placeCity(p.address)))].sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [places],
  );
  const firstPlaceId = filtered[0]?.id ?? null;
  const activePreviewId = filtered.some((p) => p.id === previewId)
    ? previewId
    : firstPlaceId;
  const mobileBounds = useMemo(
    () =>
      boundsForPlaces(
        region ? filtered : filtered.filter((p) => p.id === activePreviewId),
        map.bounds,
      ),
    [region, filtered, activePreviewId, map.bounds],
  );
  useEffect(() => {
    if (!mobile || detailId) return;
    const timer = window.setTimeout(() => {
      setPreviewId(activePreviewId);
      setSelected(activePreviewId);
      if (activePreviewId && activePreviewId !== previewId && !region)
        setFocusRequest((request) => request + 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mobile, activePreviewId, detailId, previewId, region]);
  const selectPreview = (id: string) => {
    setStationFocus(null);
    setSelected(id);
    setPreviewId(id);
    setFocusRequest((request) => request + 1);
  };
  const visiblePlaces = useMemo(
    () => filtered.slice(0, page * 20),
    [filtered, page],
  );
  const searchSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const suggestions = places.map((place) => ({
      term: place.name,
      kind: "장소",
    }));
    return suggestions
      .filter((suggestion) =>
        suggestion.term.toLowerCase().includes(normalized),
      )
      .filter(
        (suggestion, index, all) =>
          all.findIndex((item) => item.term === suggestion.term) === index,
      )
      .slice(0, 5);
  }, [places, query]);
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
  async function searchArea() {
    if (!viewport) return;
    const requestId = ++latest.current;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/maps/${map.id}/places?${new URLSearchParams(Object.entries(viewport).map(([k, v]) => [k, String(v)]))}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (requestId === latest.current) {
        setLoaded(data.items);
        setTruncated(data.truncated);
        setPage(1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (requestId === latest.current) setBusy(false);
    }
  }
  const selectedPlace =
    [...places, ...pendingPlaces].find((p) => p.id === detailId) ?? null;
  const previewPlace =
    [...places, ...pendingPlaces].find((p) => p.id === previewId) ?? null;
  const toggleFollow = async () => {
    if (!viewer) {
      router.push(loginHref(`/maps/${map.slug}`));
      return;
    }
    setBusy(true);
    try {
      await post("/api/community", {
        action: "follow",
        id: map.id,
        enabled: !myState.followed,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const votePlace = async (id: string, value: 1 | -1) => {
    if (demo) return;
    setBusy(true);
    setError("");
    try {
      await post("/api/community", {
        action: "vote",
        id,
        value: myState.votes[id] === value ? 0 : value,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const savePlace = async (id: string, undo = false) => {
    if (demo || busy) return;
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
    setBusy(true);
    setError("");
    setFailedSaveId(null);
    try {
      await post("/api/community", { action: "save", id, enabled });
      setSavedOverrides((current) => ({ ...current, [id]: enabled }));
      setSaveNotice(
        undo
          ? null
          : {
              id,
              name: places.find((place) => place.id === id)?.name ?? "장소",
              enabled,
            },
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setFailedSaveId(id);
    } finally {
      setBusy(false);
    }
  };
  const focusPlace = useCallback(
    (id: string) => {
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
        setPreviewId(null);
        setDetailId(id);
        trackCommunityEvent("place_detail_opened", {
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
    [config.provider, mobile, mobileView],
  );
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
            <p className="map-hero-description mt-1 line-clamp-2 md:line-clamp-1 max-w-2xl text-xs leading-5 text-muted-foreground">
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
              variant={myState.followed ? "secondary" : "outline"}
              disabled={busy}
              onClick={toggleFollow}
            >
              {myState.followed ? <Check size={14} /> : <Plus size={14} />}{" "}
              {myState.followed ? "팔로우 중" : "팔로우"}
            </Button>
            <Button asChild>
              <Link href={`/maps/${map.slug}/submit`} prefetch={false}>
                <Plus size={15} />
                장소 제안
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
            {map.follower_count} 팔로워
          </span>
          <span>{map.contributor_count} 기여자</span>
          <details className="ml-auto max-w-lg">
            <summary className="cursor-pointer">커뮤니티 규칙 보기</summary>
            <p className="pt-3 leading-6">{map.rules}</p>
          </details>
        </div>
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
            <ShareButton path={`/maps/${map.slug}`} title={map.title} />
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
              {map.follower_count} 팔로워
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
              variant={myState.followed ? "secondary" : "outline"}
              disabled={busy}
              onClick={toggleFollow}
            >
              {myState.followed ? <Check size={15} /> : <Plus size={15} />}
              {myState.followed ? "팔로우 중" : "팔로우"}
            </Button>
            <Button asChild>
              <Link href={`/maps/${map.slug}/submit`} prefetch={false}>
                <Plus size={15} />
                장소 제안
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div
        className="visit-view-switch flex rounded-xl border bg-card p-0.5 lg:hidden"
        role="group"
        aria-label="장소 보기 방식"
      >
        <button
          aria-label="목록 보기"
          aria-pressed={mobileView === "list"}
          aria-controls="explorer-list"
          onClick={() => {
            changeView("list");
            trackCommunityEvent("community_view_changed", {
              provider: config.provider,
              view: "list",
            });
          }}
        >
          <List size={17} aria-hidden="true" />
          <span>목록</span>
        </button>
        <button
          aria-label="지도 보기"
          aria-pressed={mobileView === "map"}
          aria-controls="explorer-map"
          onClick={() => {
            changeView("map");
            trackCommunityEvent("community_view_changed", {
              provider: config.provider,
              view: "map",
            });
          }}
        >
          <MapIcon size={17} aria-hidden="true" />
          <span>지도</span>
        </button>
        <span className="px-2 text-xs text-muted-foreground">
          {filtered.length}곳
        </span>
      </div>
      <div
        data-search-open={searchOpen}
        className="glass-toolbar explorer-toolbar flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 md:px-9"
      >
        <div className="search-sort-group flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="relative w-full sm:w-60">
            <Search
              className="absolute top-2.5 left-3 text-muted-foreground"
              size={14}
            />
            <Input
              ref={searchInput}
              className="h-9 bg-background pl-9 text-xs"
              value={query}
              onChange={(e) => {
                const value = e.target.value;
                setQuery(value);
                setPage(1);
                if (value.trim() && !searchTracked.current) {
                  searchTracked.current = true;
                  trackCommunityEvent("place_search_started", {
                    provider: config.provider,
                  });
                }
              }}
              placeholder="이 맵의 장소 검색"
              aria-label="이 맵의 장소 검색"
            />
            {searchSuggestions.length > 0 && (
              <div
                className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 overflow-hidden rounded-xl border bg-card p-1 shadow-lg"
                role="listbox"
                aria-label="관련 검색어"
              >
                {searchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.term}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-secondary"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setQuery(suggestion.term);
                      setPage(1);
                      trackCommunityEvent("place_search_suggestion_selected", {
                        provider: config.provider,
                      });
                    }}
                  >
                    <span>{suggestion.term}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {suggestion.kind}
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
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <details className="mobile-map-filter-menu lg:hidden">
          <summary>
            필터{region || sort !== "relevance" ? " · 적용 중" : ""}
          </summary>
          <div className="mobile-explorer-filters">
            <select
              aria-label="장소 지역"
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
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
                  {option.value === "relevance" ? "종합 추천순" : option.label}
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
      {mobile && (truncated || loaded !== null) && (
        <p className="px-4 py-2 text-sm text-muted-foreground" role="status">
          현재 불러온 {places.length}곳에서 탐색 중
          {truncated ? " · 일부 결과" : ""}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="bg-destructive/5 px-6 py-3 text-sm text-destructive"
        >
          {error}
          {failedSaveId && (
            <button
              className="ml-3 underline"
              disabled={busy}
              onClick={() => void savePlace(failedSaveId)}
            >
              저장 다시 시도
            </button>
          )}
        </p>
      )}
      {saveNotice && (
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
            disabled={busy}
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
          places={pendingPlaces}
          viewer={viewer}
          votes={myState.votes}
          demo={demo}
          onChange={() => router.refresh()}
        />
      )}
      <div
        data-mobile-view={mobileView}
        className={`glass-map-shell explorer-layout ${selectedPlace ? "has-detail" : ""}`}
      >
        <section
          id="explorer-list"
          className="place-list lg:h-fit lg:max-h-[calc(100dvh-250px)] lg:min-h-[480px] lg:self-start lg:overflow-y-auto"
          aria-label="장소 목록"
        >
          <div className="place-list-heading sticky top-0 z-10 flex items-center justify-between border-b px-3 py-3">
            <span className="text-xs font-medium">
              {filtered.length}개의 발견
              {filtered.length > visiblePlaces.length &&
                ` · 현재 ${visiblePlaces.length}곳 표시`}
              {truncated && " · 일부 결과"}
            </span>
          </div>
          {visiblePlaces.map((p, i) => {
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
                        <span className="place-badge place-badge-new">NEW</span>
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
                    className="place-card-votes hidden lg:flex items-center gap-1.5"
                    aria-label={`${p.name} 주제 적합성 투표`}
                  >
                    <button
                      type="button"
                      className="vote-control"
                      aria-label={`${p.name} 테마에 잘 맞아요 ${p.positive}`}
                      aria-pressed={myState.votes[p.id] === 1}
                      disabled={demo || busy}
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
                      aria-pressed={myState.votes[p.id] === -1}
                      disabled={demo || busy}
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
                    disabled={demo || busy}
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
          {filtered.length === 0 && (
            <div className="px-8 py-18 text-center">
              <MapPin className="mx-auto mb-4 text-muted-foreground" />
              <h2 className="font-medium">아직 발견된 장소가 없어요.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                다른 조건으로 찾아보거나,
                <br />이 주제에 맞는 첫 장소를 제안해 주세요.
              </p>
              {query && (
                <Button
                  variant="secondary"
                  className="mt-5 mr-2"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                >
                  검색 조건 초기화
                </Button>
              )}
              <Button asChild variant="outline" className="mt-5">
                <Link href={`/maps/${map.slug}/submit`} prefetch={false}>
                  장소 제안하기
                </Link>
              </Button>
            </div>
          )}
          {filtered.length > page * 20 && (
            <Button
              variant="ghost"
              className="my-3 w-full"
              onClick={() => setPage((p) => p + 1)}
            >
              더 보기
            </Button>
          )}
        </section>
        <section
          id="explorer-map"
          aria-label="장소 지도"
          className="explorer-map relative min-w-0 min-h-[420px] lg:h-[calc(100dvh-250px)]"
        >
          <MapCanvas
            key={mobile ? `mobile-${region}` : "desktop"}
            onFallback={mobile ? () => changeView("list") : undefined}
            userLocation={userLocation}
            stationFocus={stationFocus}
            places={[...filtered, ...pendingPlaces]}
            selected={mobile ? activePreviewId : selected}
            onSelect={(id) => {
              if (pendingPlaces.some((p) => p.id === id)) {
                setSelected(id);
                setShowPending(true);
              } else focusPlace(id);
            }}
            onFocusComplete={(id) => {
              if (!mobile) setDetailId(id);
            }}
            focusRequest={focusRequest}
            bounds={mobile ? mobileBounds : initialBounds}
            onBoundsChange={onBoundsChange}
            config={config}
          />
          <Button
            variant="outline"
            className="location-button absolute top-28 right-3 z-20 shadow-lg"
            disabled={locating}
            onClick={() => locate()}
          >
            <MapPin size={14} />
            {locating ? "위치 확인 중…" : "내 위치"}
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
          {viewport && config.provider !== "preview" && (
            <Button
              className="search-area-button absolute top-5 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
              disabled={busy}
              onClick={searchArea}
            >
              <Search size={14} />
              {busy ? "불러오는 중" : "이 지역에서 다시 찾기"}
            </Button>
          )}
          {mobile ? (
            filtered.length ? (
              <MobilePlaceCarousel
                demo={demo}
                onStationSelect={(station, place) =>
                  selectStation(station, place)
                }
                places={filtered}
                activeId={activePreviewId}
                onSelect={selectPreview}
                onOpen={(id) => {
                  setSelected(id);
                  setDetailId(id);
                }}
                onSave={(id) => void savePlace(id)}
                isSaved={isSaved}
                disabled={demo || busy}
              />
            ) : (
              <div className="mobile-map-empty" role="status">
                <p>조건에 맞는 장소가 없어요.</p>
                <button
                  aria-label="빈 결과를 목록으로 보기"
                  className="text-sm underline"
                  onClick={() => changeView("list")}
                >
                  목록 보기
                </button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setRegion("");
                  }}
                >
                  검색 조건 초기화
                </Button>
              </div>
            )
          ) : previewPlace ? (
            <PlacePreview
              onStationSelect={(station) =>
                selectStation(station, previewPlace)
              }
              place={previewPlace}
              loginHref={loginHref(
                `/maps/${map.slug}?place=${encodeURIComponent(previewPlace.place_id)}`,
              )}
              saved={isSaved(previewPlace.id)}
              vote={myState.votes[previewPlace.id] ?? 0}
              demo={demo}
              signedIn={Boolean(viewer)}
              busy={busy}
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
                href={`/maps/${map.slug}/submit`}
                prefetch={false}
                className="absolute right-4 bottom-16 z-10 hidden min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg max-lg:inline-flex"
              >
                <Plus size={16} aria-hidden="true" />
                장소 제안
              </Link>
            </>
          )}
        </section>
        <PlaceDetail
          userLocation={userLocation}
          key={detailId ?? "closed"}
          sharePath={`/maps/${map.slug}${selectedPlace ? `?place=${encodeURIComponent(selectedPlace.place_id)}` : ""}`}
          onStationSelect={(station) => {
            if (selectedPlace) selectStation(station, selectedPlace);
          }}
          place={selectedPlace}
          loginHref={loginHref(
            `/maps/${map.slug}${selectedPlace ? `?place=${encodeURIComponent(selectedPlace.place_id)}` : ""}`,
          )}
          onClose={() => {
            setDetailId(null);
            if (mobile && mobileView === "map" && selected) {
              setPreviewId(selected);
            }
          }}
          viewer={viewer}
          vote={myState.votes[detailId ?? ""] ?? 0}
          saved={isSaved(detailId ?? "")}
          demo={demo}
          onChange={() => {
            setSavedOverrides({});
            setLoaded(null);
            router.refresh();
          }}
        />
      </div>
    </main>
  );
}
