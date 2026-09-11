"use client";
import { useViewerState } from "./viewer-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  Info,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapCanvas } from "@/components/map/map-canvas";
import { PlaceDetail } from "./place-detail";
import { post } from "./api";
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
  viewer: initialViewer,
  config,
  myState: initialMyState,
  demo,
}: {
  map: ThemeMap;
  initialPlaces: MapPlace[];
  viewer: Viewer | null;
  config: RendererConfig;
  myState: {
    votes: Record<string, number>;
    saves: string[];
    followed: boolean;
  };
  demo: boolean;
}) {
  const personalized = useViewerState();
  const viewer = personalized.viewer ?? initialViewer;
  const myState = personalized.viewer ? personalized.myState : initialMyState;
  const router = useRouter();
  const [query, setQuery] = useState(""),
    [tag, setTag] = useState("전체"),
    [sort, setSort] = useState<Sort>("relevance"),
    [selected, setSelected] = useState<string | null>(null),
    [viewport, setViewport] = useState<Bounds | null>(null),
    [loaded, setLoaded] = useState<MapPlace[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [truncated, setTruncated] = useState(initialPlaces.length > 500),
    [page, setPage] = useState(1);
  const latest = useRef(0);
  const places = loaded ?? initialPlaces.slice(0, 500);
  const filtered = useMemo(
    () =>
      sortPlaces(
        places.filter(
          (p) =>
            (tag === "전체" || p.category === tag) &&
            `${p.name} ${p.rationale}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        ),
        sort,
      ),
    [places, tag, query, sort],
  );
  const onBoundsChange = useCallback((b: Bounds) => setViewport(b), []);
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
  const selectedPlace = places.find((p) => p.id === selected) ?? null;
  return (
    <main id="main" className="mx-auto max-w-[1440px]">
      <div className="map-hero border-b px-5 py-3 md:px-9">
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
              <Badge variant="secondary" className="text-[10px]">
                공개 커뮤니티
              </Badge>
              <span className="kicker">{formatLocation(map)}</span>
            </div>
            <p className="mt-1 line-clamp-2 md:line-clamp-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {map.description}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={myState.followed ? "secondary" : "outline"}
              disabled={busy}
              onClick={async () => {
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
              }}
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
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
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
          <p className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Info size={13} />
            미리보기 · 가상 장소이며 실제 추천·검증 정보가 아닙니다.
          </p>
        )}
      </div>
      <div className="glass-toolbar flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 md:px-9">
        <div className="flex flex-nowrap gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible">
          {["전체", ...map.tags.filter((t) => t !== "전체")].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tag === t ? "default" : "ghost"}
              className="h-8 shrink-0 rounded-full px-3 text-xs"
              onClick={() => {
                setTag(t);
                setPage(1);
              }}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-60">
          <Search
            className="absolute top-2.5 left-3 text-muted-foreground"
            size={14}
          />
          <Input
            className="h-9 bg-background pl-9 text-xs"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="이 맵의 장소 검색"
            aria-label="이 맵의 장소 검색"
          />
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="bg-destructive/5 px-6 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="glass-map-shell lg:grid lg:grid-cols-[20%_80%]">
        <section
          className="place-list lg:h-fit lg:max-h-[calc(100dvh-250px)] lg:min-h-[480px] lg:self-start lg:overflow-y-auto lg:border-r"
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
                className={`place-glass-card group p-4 transition-colors ${selected === p.id ? "ring-1 ring-primary/60" : ""}`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => setSelected(p.id)}
                      className="text-left text-base font-semibold tracking-tight hover:underline"
                    >
                      {p.name}
                    </button>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {p.category} · {demo ? "Tokyo / 가상 예시" : p.address}
                    </p>
                  </div>
                  <button
                    aria-label={`${p.name} 상세 보기`}
                    onClick={() => setSelected(p.id)}
                    className="p-1 text-muted-foreground"
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <p className="ml-9 line-clamp-2 text-[13px] leading-6 text-muted-foreground">
                  {p.rationale}
                </p>
                <div className="mt-4 ml-9 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="flex items-center gap-1 rounded bg-secondary px-2 py-1 font-medium text-primary">
                      <Check size={11} />
                      {total
                        ? `${Math.round((p.positive / total) * 100)}% 적합`
                        : "검증 대기"}
                    </span>
                    <span className="text-muted-foreground">
                      {total}명 검증
                    </span>
                  </div>
                  <button
                    aria-label={`${p.name} 저장`}
                    onClick={() => setSelected(p.id)}
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
          aria-label="장소 지도"
          className="relative min-h-[420px] lg:h-[calc(100dvh-250px)]"
        >
          <MapCanvas
            places={filtered}
            selected={selected}
            onSelect={setSelected}
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
          <div className="absolute bottom-15 left-5 rounded-lg border bg-card/95 px-3 py-2 text-[10px] text-muted-foreground">
            순위는 일반 별점이 아닌, 이 주제에 대한 검증입니다.
          </div>
        </section>
      </div>
      <PlaceDetail
        key={selected ?? "closed"}
        place={selectedPlace}
        onClose={() => setSelected(null)}
        viewer={viewer}
        vote={myState.votes[selected ?? ""] ?? 0}
        saved={myState.saves.includes(selected ?? "")}
        demo={demo}
        onChange={() => {
          setLoaded(null);
          router.refresh();
        }}
      />
    </main>
  );
}
