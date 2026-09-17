"use client";
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
  Users,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapCanvas } from "@/components/map/map-canvas";
import { PlaceDetail } from "./place-detail";
import { PlacePreview } from "./place-preview";
import { PendingReview } from "./pending-review";
import { post } from "./api";
import { trackCommunityEvent } from "@/lib/community-analytics";
import { sortPlaces } from "@/domain/relevance";
import { formatLocation } from "@/domain/location";
import type {
  Bounds,
  MapPlace,
  RendererConfig,
  Sort,
  ThemeMap,
  Viewer,
} from "@/domain/types";
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
  const [mobileView, setMobileView] = useState<"list" | "map">("map");
  const [infoOpen, setInfoOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const personalized = useViewerState();
  const viewer = personalized.viewer ?? initialViewer;
  const myState = personalized.viewer ? personalized.myState : initialMyState;
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPlaceId = searchParams.get("place");
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
  const openedPlaceId = useRef<string | null>(null);
  const searchTracked = useRef(false);
  const places = useMemo(
    () => loaded ?? initialPlaces.slice(0, 500),
    [initialPlaces, loaded],
  );
  const filtered = useMemo(
    () =>
      sortPlaces(
        places.filter((p) =>
          `${p.name} ${p.category} ${p.rationale}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
        sort,
      ),
    [places, query, sort],
  );
  const searchSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const suggestions = places.flatMap((place) => [
      { term: place.name, kind: "장소" },
      { term: place.category, kind: "분류" },
    ]);
    return suggestions
      .filter((suggestion) => suggestion.term.toLowerCase().includes(normalized))
      .filter(
        (suggestion, index, all) =>
          all.findIndex((item) => item.term === suggestion.term) === index,
      )
      .slice(0, 5);
  }, [places, query]);
  const onBoundsChange = useCallback((b: Bounds) => {
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
      router.push("/login");
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
  const focusPlace = useCallback(
    (id: string) => {
      setSelected(id);
      if (mobile) {
        if (mobileView === "map") {
          setDetailId(null);
          setPreviewId(id);
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
      if (config.provider === "preview" || config.provider === "kakao") {
        setDetailId(id);
        return;
      }
      setDetailId((current) => (current ? id : null));
      setFocusRequest((request) => request + 1);
    },
    [config.provider, mobile, mobileView],
  );
  useEffect(() => {
    if (!requestedPlaceId || openedPlaceId.current === requestedPlaceId) return;
    const mapPlace = [...places, ...pendingPlaces].find(
      (place) => place.place_id === requestedPlaceId,
    );
    if (!mapPlace) return;
    const timer = window.setTimeout(() => {
      openedPlaceId.current = requestedPlaceId;
      setSelected(mapPlace.id);
      setPreviewId(null);
      setDetailId(mapPlace.id);
      trackCommunityEvent("place_detail_opened", {
        entry: "deep_link",
        provider: config.provider,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [config.provider, pendingPlaces, places, requestedPlaceId]);
  return (
    <main
      id="main"
      className="community-explorer mx-auto max-w-[1440px]"
      data-mobile-view={mobileView}
    >
      <div
        className="map-hero border-b px-5 py-3 md:px-9"
        data-mobile-view={mobileView}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/"
              className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <ArrowLeft size={13} />
              커뮤니티 탐색
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {map.title}
              </h1>
              <span className="kicker">{formatLocation(map)}</span>
            </div>
            <p className="map-hero-description mt-1 line-clamp-2 md:line-clamp-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {map.description}
            </p>
          </div>
          <Button
            className="map-info-trigger lg:hidden"
            variant="ghost"
            size="icon"
            aria-label={`${map.title} 지도 정보 보기`}
            onClick={() => {
              setInfoOpen(true);
              trackCommunityEvent("community_info_opened", {
                provider: config.provider,
              });
            }}
          >
            <Info size={19} />
          </Button>
          <div className="map-hero-actions flex gap-2">
            <Button
              variant={myState.followed ? "secondary" : "outline"}
              disabled={busy}
              onClick={toggleFollow}
            >
              {myState.followed ? <Check size={14} /> : <Plus size={14} />}{" "}
              {myState.followed ? "팔로우 중" : "팔로우"}
            </Button>
            <Button asChild>
              <Link href={`/maps/${map.slug}/submit`}>
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
              <Link href={`/maps/${map.slug}/submit`}>
                <Plus size={15} />
                장소 제안
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="glass-toolbar explorer-toolbar flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 md:px-9">
        <div className="relative w-full sm:w-60">
          <Search
            className="absolute top-2.5 left-3 text-muted-foreground"
            size={14}
          />
          <Input
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
          className="mobile-view-switch flex rounded-xl border bg-card p-0.5 lg:hidden"
          role="group"
          aria-label="장소 보기 방식"
        >
          <button
            aria-label="목록 보기"
            aria-pressed={mobileView === "list"}
            aria-controls="explorer-list"
            onClick={() => {
              setMobileView("list");
              trackCommunityEvent("community_view_changed", {
                provider: config.provider,
                view: "list",
              });
            }}
          >
            <List size={17} aria-hidden="true" />
            <span className="sr-only">목록 보기</span>
          </button>
          <button
            aria-label="지도 보기"
            aria-pressed={mobileView === "map"}
            aria-controls="explorer-map"
            onClick={() => {
              setMobileView("map");
              trackCommunityEvent("community_view_changed", {
                provider: config.provider,
                view: "map",
              });
            }}
          >
            <MapIcon size={17} aria-hidden="true" />
            <span className="sr-only">지도 보기</span>
          </button>
        </div>
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
        </p>
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
              {filtered.length}개의 발견 {truncated && "· 일부 결과"}
            </span>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger
                className="h-8 w-32 border-0 text-xs"
                aria-label="장소 정렬"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">주제 적합순</SelectItem>
                <SelectItem value="newest">최근 추가순</SelectItem>
                <SelectItem value="verified">최근 검증순</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtered.slice(0, page * 20).map((p, i) => {
            const total = p.positive + p.negative;
            return (
              <article
                key={p.id}
                onClick={() => focusPlace(p.id)}
                className={`place-glass-card group cursor-pointer p-3 transition-colors ${selected === p.id ? "ring-1 ring-primary/60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        focusPlace(p.id);
                      }}
                      className="text-left text-sm font-semibold tracking-tight hover:underline"
                    >
                      {p.name}
                    </button>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {demo ? "가상 예시" : p.category}
                    </p>
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
                <p className="mt-3 ml-8 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {p.rationale}
                </p>
                <div className="mt-2 ml-8 flex items-center justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px]">
                    <span className="flex items-center gap-1 rounded bg-secondary px-2 py-1 font-medium text-primary">
                      <Check size={11} />
                      {total
                        ? `${total}명 중 ${p.positive}명 추천`
                        : "검증 대기"}
                    </span>
                    <span className="text-muted-foreground">주제 적합성</span>
                  </div>
                  <button
                    aria-label={`${p.name} 저장 옵션 보기`}
                    onClick={(event) => {
                      event.stopPropagation();
                      focusPlace(p.id);
                    }}
                    className="p-1 text-muted-foreground"
                  >
                    <Bookmark
                      size={15}
                      fill={
                        myState.saves.includes(p.id) ? "currentColor" : "none"
                      }
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
                <Link href={`/maps/${map.slug}/submit`}>장소 제안하기</Link>
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
            places={[...filtered, ...pendingPlaces]}
            selected={selected}
            onSelect={(id) => {
              if (pendingPlaces.some((p) => p.id === id)) {
                setSelected(id);
                setShowPending(true);
              } else focusPlace(id);
            }}
            onFocusComplete={(id) => setDetailId(id)}
            focusRequest={focusRequest}
            bounds={map.bounds}
            onBoundsChange={onBoundsChange}
            config={config}
          />
          {viewport && config.provider !== "preview" && (
            <Button
              className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
              disabled={busy}
              onClick={searchArea}
            >
              <Search size={14} />
              {busy ? "불러오는 중" : "이 지역에서 다시 찾기"}
            </Button>
          )}
          {previewPlace ? (
            <PlacePreview
              place={previewPlace}
              saved={myState.saves.includes(previewPlace.id)}
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
              onSave={async () => {
                setBusy(true);
                setError("");
                try {
                  await post("/api/community", {
                    action: "save",
                    id: previewPlace.id,
                    enabled: !myState.saves.includes(previewPlace.id),
                  });
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : (
            <div className="absolute bottom-15 left-5 rounded-lg border bg-card/95 px-3 py-2 text-[10px] text-muted-foreground">
              순위는 일반 별점이 아닌, 이 주제에 대한 검증입니다.
            </div>
          )}
        </section>
        <PlaceDetail
          key={detailId ?? "closed"}
          place={selectedPlace}
          onClose={() => {
            setDetailId(null);
            if (mobile && mobileView === "map" && selected) {
              setPreviewId(selected);
            }
          }}
          viewer={viewer}
          vote={myState.votes[detailId ?? ""] ?? 0}
          saved={myState.saves.includes(detailId ?? "")}
          demo={demo}
          onChange={() => {
            setLoaded(null);
            router.refresh();
          }}
        />
      </div>
    </main>
  );
}
