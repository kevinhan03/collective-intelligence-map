"use client";

import Link from "@/i18n/link";
import { SavedMaps } from "./saved-maps";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ExternalLink,
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
import { placeArea } from "@/domain/place-location";
import { post } from "./api";

import { useI18n } from "@/i18n/client";
export type SavedPlace = MapPlace & {
  map_slug: string;
  map_title: string;
  saved_at: string;
};

export function SavedPlaces({
  initialCards,
  savedMaps = [],
  maps,
  config,
}: {
  initialCards: SavedPlace[];
  savedMaps?: ThemeMap[];
  maps: ThemeMap[];
  config: RendererConfig;
}) {
  const { t } = useI18n();
  const [cards, setCards] = useState(initialCards);
  const [query, setQuery] = useState("");
  const [mapId, setMapId] = useState("all");
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    initialCards[0]?.id ?? null,
  );
  const [mapSelection, setMapSelection] = useState(false);
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
          `${place.name} ${place.rationale} ${place.map_title} ${place.address} ${placeArea(place.address)}`
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
      if (selected === place.id) {
        setSelected(remaining[0]?.id ?? null);
        setMapSelection(false);
      }
    } catch (cause) {
      setError(t.message((cause as Error).message));
    } finally {
      setBusy(null);
    }
  }

  if (!cards.length) return <SavedEmpty savedMaps={savedMaps} />;

  return (
    <main
      id="main"
      className="saved-page mx-auto min-h-[calc(100dvh-96px)] max-w-[1440px] px-4 pb-6 sm:px-6 lg:px-8"
    >
      <section className="glass-panel mt-5 overflow-hidden rounded-4xl px-5 py-5 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="kicker hidden lg:block">Personal collection</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("saved.savedPlaces")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("saved.collectionSummary", { count: cards.length })}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              {t("saved.discover")} <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </section>

      <SavedMaps maps={savedMaps} />
      <section className="mt-4 grid gap-4 lg:min-h-[calc(100dvh-270px)] lg:grid-cols-[minmax(270px,0.8fr)_minmax(0,1.5fr)_minmax(300px,0.9fr)]">
        <aside className="glass-panel order-0 rounded-3xl p-4 lg:order-none lg:overflow-y-auto lg:p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal size={16} /> {t("saved.myCollection")}
          </div>
          <label className="relative mt-5 block">
            <Search
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              size={15}
            />
            <Input
              aria-label={t("saved.searchSavedPlaces")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("saved.searchPlacesAreasOrThemes")}
              className="h-10 pl-9"
            />
          </label>
          <div className="mt-5 flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            <button
              className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition lg:w-full ${mapId === "all" ? "bg-primary text-primary-foreground" : "hover:bg-white/10"}`}
              onClick={() => setMapId("all")}
            >
              {t("saved.allPlaces")}{" "}
              <span className="text-xs opacity-70">{cards.length}</span>
            </button>
            {mapOptions.map((map) => {
              const count = cards.filter(
                (place) => place.map_id === map.id,
              ).length;
              return (
                <button
                  key={map.id}
                  className={`flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition lg:w-full ${mapId === map.id ? "bg-primary text-primary-foreground" : "hover:bg-white/10"}`}
                  onClick={() => {
                    setMapId(map.id);
                    setMapSelection(false);
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
          <p className="mt-6 hidden border-t pt-4 text-xs leading-5 text-muted-foreground lg:block">
            {t("saved.savesAreYourPrivateCollection")}
          </p>
        </aside>

        <section
          id="saved-places-map"
          aria-label={t("saved.savedPlacesMap")}
          className={`glass-map-shell relative order-3 m-0 min-h-[320px] lg:order-none lg:min-h-0 ${showMobileMap ? "" : "hidden lg:block"}`}
        >
          {activeMap ? (
            <MapCanvas
              places={mapPlaces}
              selected={
                selectedPlace?.map_id === activeMap.id ? selected : null
              }
              onSelect={(id) => {
                setSelected(id);
                setMapSelection(true);
              }}
              bounds={activeMap.bounds}
              onBoundsChange={() => undefined}
              config={config}
            />
          ) : null}
          {activeMap && (
            <div className="absolute top-4 left-4 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 text-xs backdrop-blur-xl">
              <p className="font-medium">{activeMap.title}</p>
              <p className="mt-0.5 text-muted-foreground">
                {t("saved.savedCount", { count: mapPlaces.length })}
              </p>
            </div>
          )}
          {mapSelection && selectedPlace?.map_id === activeMap?.id && (
            <div className="absolute right-3 bottom-3 left-3 rounded-2xl border border-white/15 bg-card/95 p-4 shadow-xl backdrop-blur-xl sm:right-auto sm:left-4 sm:w-72">
              <button
                type="button"
                aria-label={t("saved.closeSelectedPlaceInfo")}
                className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                onClick={() => setMapSelection(false)}
              >
                <X size={16} />
              </button>
              <p className="pr-8 text-sm font-semibold">{selectedPlace.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[selectedPlace.map_title, placeArea(selectedPlace.address)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/maps/${selectedPlace.map_slug}?place=${selectedPlace.place_id}`}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
                >
                  {t("saved.viewDetails")}
                </Link>
                <a
                  href={`/go/${selectedPlace.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border px-3 text-xs font-semibold"
                >
                  {t("saved.directions")}{" "}
                  <ExternalLink size={13} className="ml-1" />
                </a>
              </div>
            </div>
          )}
          {selectedPlace && selectedPlace.map_id !== activeMap?.id && (
            <button
              className="absolute right-4 bottom-4 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg"
              onClick={() => setMapId(selectedPlace.map_id)}
            >
              {t("saved.viewSelectedPlaceOnMap")}
            </button>
          )}
        </section>

        <section className="glass-panel order-1 flex min-h-0 flex-col rounded-3xl p-3 lg:order-none lg:min-h-[420px] lg:overflow-hidden">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-sm font-medium">{t("saved.placesFound")}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {t("saved.placeCount", { count: filtered.length })}
              </span>
              <button
                type="button"
                className="min-h-11 text-xs font-medium text-primary lg:hidden"
                aria-expanded={showMobileMap}
                aria-controls="saved-places-map"
                onClick={() => setShowMobileMap((current) => !current)}
              >
                {showMobileMap ? t("saved.closeMap") : t("saved.mapView")}
              </button>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1">
            {filtered.map((place) => (
              <article
                key={place.id}
                data-selected={selected === place.id}
                className="place-glass-card cursor-pointer p-4 transition"
                onClick={() => {
                  setSelected(place.id);
                  setMapId(place.map_id);
                  setMapSelection(false);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      <Link
                        href={`/maps/${place.map_slug}?place=${place.place_id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="hover:underline"
                      >
                        {place.name}
                      </Link>
                    </h2>
                    <Badge
                      variant="secondary"
                      className="mt-2 max-w-full truncate text-[10px]"
                    >
                      {place.map_title}
                    </Badge>
                  </div>
                  <Button
                    aria-label={t("saved.unsave", { name: place.name })}
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
                {place.rationale && (
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {place.rationale}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <MapPin size={12} />{" "}
                    {[
                      t.data("placeCategory", place.category),
                      placeArea(place.address),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <Link
                    className="text-primary hover:underline"
                    href={`/maps/${place.map_slug}?place=${place.place_id}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t("saved.originalMap")}
                  </Link>
                </div>
                <a
                  href={`/go/${place.id}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink size={14} /> {t("saved.directionsInGoogleMaps")}
                </a>
              </article>
            ))}
            {!filtered.length && (
              <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                <p>{t("saved.noSavedPlacesMatch")}</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setMapId("all");
                  }}
                >
                  {t("saved.clearFilters")}
                </Button>
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

function SavedEmpty({ savedMaps }: { savedMaps: ThemeMap[] }) {
  const { t } = useI18n();
  return (
    <main
      id="main"
      className="mx-auto min-h-[calc(100dvh-96px)] max-w-[1440px] px-5 py-6"
    >
      <SavedMaps maps={savedMaps} />
      <section className="glass-panel mx-auto mt-8 max-w-md rounded-4xl px-8 py-14 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-primary text-primary-foreground">
          <Bookmark size={25} />
        </span>
        <p className="kicker mt-7">Your collection starts here</p>
        <h1 className="mt-3 text-2xl font-semibold">
          {t("saved.collectPlacesYouWantTo")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("saved.savePlacesYouLikeFrom")}
        </p>
        <Button asChild className="mt-7">
          <Link href="/">
            <Check /> {t("saved.discover")}
          </Link>
        </Button>
      </section>
    </main>
  );
}
