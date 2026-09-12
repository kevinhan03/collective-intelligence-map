"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MapCanvas } from "@/components/map/map-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MapPlace, RendererConfig, ThemeMap } from "@/domain/types";
import { post } from "./api";

export type SavedPlace = MapPlace & {
  map_slug: string;
  map_title: string;
  saved_at: string;
};

export function SavedPlaces({
  initialCards,
  maps,
  config,
}: {
  initialCards: SavedPlace[];
  maps: ThemeMap[];
  config: RendererConfig;
}) {
  const [cards, setCards] = useState(initialCards);
  const [query, setQuery] = useState("");
  const [mapId, setMapId] = useState("all");
  const [selected, setSelected] = useState<string | null>(
    initialCards[0]?.id ?? null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const mapOptions = useMemo(
    () => maps.filter((map) => cards.some((place) => place.map_id === map.id)),
    [cards, maps],
  );
  const activeMap =
    mapOptions.find((map) => map.id === mapId) ?? mapOptions[0] ?? null;
  const filtered = useMemo(
    () =>
      cards.filter(
        (place) =>
          (mapId === "all" || place.map_id === mapId) &&
          `${place.name} ${place.rationale} ${place.map_title}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [cards, mapId, query],
  );
  const mapPlaces = useMemo(
    () =>
      activeMap ? cards.filter((place) => place.map_id === activeMap.id) : [],
    [activeMap, cards],
  );
  const selectedPlace = cards.find((place) => place.id === selected) ?? null;

  async function remove(place: SavedPlace) {
    setBusy(place.id);
    setError("");
    try {
      await post("/api/community", {
        action: "save",
        id: place.id,
        enabled: false,
      });
      const remaining = cards.filter((item) => item.id !== place.id);
      setCards(remaining);
      if (selected === place.id) setSelected(remaining[0]?.id ?? null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!cards.length) return <SavedEmpty />;

  return (
    <main
      id="main"
      className="mx-auto min-h-[calc(100dvh-96px)] max-w-[1440px] px-4 pb-6 sm:px-6 lg:px-8"
    >
      <section className="glass-panel mt-5 overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="kicker">Personal collection</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              저장한 장소
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Theme Map에서 다시 찾고 싶은 {cards.length}곳을 모아두었어요.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              커뮤니티 탐색 <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mt-4 grid min-h-[calc(100dvh-270px)] gap-4 lg:grid-cols-[minmax(270px,0.8fr)_minmax(0,1.5fr)_minmax(300px,0.9fr)]">
        <aside className="glass-panel rounded-3xl p-4 lg:overflow-y-auto lg:p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal size={16} /> 내 컬렉션
          </div>
          <label className="relative mt-5 block">
            <Search
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              size={15}
            />
            <Input
              aria-label="저장한 장소 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="장소 또는 테마 검색"
              className="h-10 pl-9"
            />
          </label>
          <div className="mt-5 space-y-1">
            <button
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${mapId === "all" ? "bg-primary text-primary-foreground" : "hover:bg-white/10"}`}
              onClick={() => setMapId("all")}
            >
              전체 장소{" "}
              <span className="text-xs opacity-70">{cards.length}</span>
            </button>
            {mapOptions.map((map) => {
              const count = cards.filter(
                (place) => place.map_id === map.id,
              ).length;
              return (
                <button
                  key={map.id}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${mapId === map.id ? "bg-primary text-primary-foreground" : "hover:bg-white/10"}`}
                  onClick={() => {
                    setMapId(map.id);
                    setSelected(
                      cards.find((place) => place.map_id === map.id)?.id ??
                        null,
                    );
                  }}
                >
                  <span className="truncate">{map.title}</span>
                  <span className="ml-2 text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-6 border-t pt-4 text-xs leading-5 text-muted-foreground">
            저장은 개인 컬렉션입니다. 추천 근거와 검증은 각 Theme Map에서 공개로
            관리됩니다.
          </p>
        </aside>

        <section
          aria-label="저장한 장소 지도"
          className="glass-map-shell relative m-0 min-h-[360px] lg:min-h-0"
        >
          {activeMap ? (
            <MapCanvas
              places={mapPlaces}
              selected={
                selectedPlace?.map_id === activeMap.id ? selected : null
              }
              onSelect={setSelected}
              bounds={activeMap.bounds}
              onBoundsChange={() => undefined}
              config={config}
            />
          ) : null}
          {activeMap && (
            <div className="absolute top-4 left-4 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs backdrop-blur-xl">
              <p className="font-medium">{activeMap.title}</p>
              <p className="mt-0.5 text-muted-foreground">
                저장한 {mapPlaces.length}곳
              </p>
            </div>
          )}
          {selectedPlace && selectedPlace.map_id !== activeMap?.id && (
            <button
              className="absolute right-4 bottom-4 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg"
              onClick={() => setMapId(selectedPlace.map_id)}
            >
              선택한 장소 지도에서 보기
            </button>
          )}
        </section>

        <section className="glass-panel flex min-h-[420px] flex-col rounded-3xl p-3 lg:overflow-hidden">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm font-medium">발견한 장소</p>
            <span className="text-xs text-muted-foreground">
              {filtered.length}곳
            </span>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1">
            {filtered.map((place) => (
              <article
                key={place.id}
                className={`place-glass-card cursor-pointer p-4 transition ${selected === place.id ? "ring-1 ring-primary" : ""}`}
                onClick={() => {
                  setSelected(place.id);
                  setMapId(place.map_id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      {place.name}
                    </h2>
                    <Badge
                      variant="secondary"
                      className="mt-2 max-w-full truncate text-[10px]"
                    >
                      {place.map_title}
                    </Badge>
                  </div>
                  <Button
                    aria-label={`${place.name} 저장 해제`}
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy === place.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void remove(place);
                    }}
                  >
                    <X size={15} />
                  </Button>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {place.rationale}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <MapPin size={12} /> {place.category}
                  </span>
                  <Link
                    className="text-primary hover:underline"
                    href={`/maps/${place.map_slug}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    원본 지도
                  </Link>
                </div>
              </article>
            ))}
            {!filtered.length && (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                조건에 맞는 저장 장소가 없어요.
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className="px-2 pt-3 text-xs text-destructive">
              {error}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function SavedEmpty() {
  return (
    <main
      id="main"
      className="mx-auto grid min-h-[calc(100dvh-96px)] max-w-[1440px] place-items-center px-5"
    >
      <section className="glass-panel max-w-md rounded-4xl px-8 py-14 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-primary text-primary-foreground">
          <Bookmark size={25} />
        </span>
        <p className="kicker mt-7">Your collection starts here</p>
        <h1 className="mt-3 text-2xl font-semibold">
          다시 가고 싶은 곳을 모아보세요.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Theme Map에서 마음에 드는 장소를 저장하면 이곳에서 한눈에 다시 찾을 수
          있어요.
        </p>
        <Button asChild className="mt-7">
          <Link href="/">
            <Check /> 커뮤니티 탐색
          </Link>
        </Button>
      </section>
    </main>
  );
}
