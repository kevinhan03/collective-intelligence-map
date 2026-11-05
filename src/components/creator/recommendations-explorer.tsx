"use client";
import Link from "@/i18n/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, List, Map as MapIcon } from "lucide-react";
import { MapCanvas } from "@/components/map/map-canvas";
import { MobilePlaceList } from "@/components/community/mobile-place-list";
import { PlaceDetail } from "@/components/community/place-detail";
import { ShareButton } from "@/components/community/share-button";
import { post } from "@/components/community/api";
import { Input } from "@/components/ui/input";
import { boundsForPlaces } from "@/domain/map-bounds";
import { loginHref } from "@/domain/login-return";
import { useMobile } from "@/hooks/use-mobile";
import type { RecommendedPlace } from "@/domain/profile";
import type { RendererConfig, Viewer, RailStation } from "@/domain/types";

import { useI18n } from "@/i18n/client";
export function RecommendationsExplorer({
  handle,
  displayName,
  places,
  config,
  viewer,
  myState,
}: {
  handle: string;
  displayName: string;
  places: RecommendedPlace[];
  config: RendererConfig;
  viewer: Viewer | null;
  myState: { saves: string[]; votes: Record<string, number> };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const mobile = useMobile();
  const path = `/u/${encodeURIComponent(handle)}/recommendations`;
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const [saveOverrides, setSaveOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false);
  const [bounds, setBounds] = useState(() =>
    boundsForPlaces(places, { west: -170, east: 170, south: -60, north: 75 }),
  );
  const [stationFocus, setStationFocus] = useState<{
    station: RailStation;
    place: { lat: number; lng: number };
  } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const filtered = useMemo(() => {
    const words = query
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return places.filter((place) =>
      words.every((word) =>
        `${place.name} ${place.address} ${place.category} ${place.rationale}`
          .normalize("NFKC")
          .toLocaleLowerCase()
          .includes(word),
      ),
    );
  }, [places, query]);
  const current = places.find((place) => place.id === detail) || null;
  const saved = (id: string) => saveOverrides[id] ?? myState.saves.includes(id);
  function changeView(next: "list" | "map") {
    if (view === "list" && list.current)
      listScroll.current = list.current.scrollTop;
    setView(next);
    if (next === "list")
      requestAnimationFrame(() => {
        if (list.current) list.current.scrollTop = listScroll.current;
      });
  }
  function open(id: string) {
    if (!mobile) changeView("map");
    setSelected(id);
    setDetail(id);
    setStationFocus(null);
    setFocus((value) => value + 1);
    const index = filtered.findIndex((place) => place.id === id);
    if (index >= 0) setLimit((value) => Math.max(value, index + 1));
  }
  async function save(id: string) {
    if (!viewer) {
      router.push(loginHref(path));
      return;
    }
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    const enabled = !saved(id);
    try {
      await post("/api/community", { action: "save", id, enabled });
      setSaveOverrides((values) => ({ ...values, [id]: enabled }));
    } catch (reason) {
      setError(t.message((reason as Error).message));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <main
      id="main"
      className="page-wrap profile-page recommendations-explorer"
      data-view={view}
    >
      <header className="recommendations-header">
        <div>
          <Link
            href={`/u/${encodeURIComponent(handle)}`}
            className="recommendations-back"
          >
            <ArrowLeft size={15} /> {t("creator.backToProfile")}
          </Link>
          <h1>{t("creator.placesIRecommended")}</h1>
          <p>
            {t("creator.publicRecommendations", {
              name: displayName,
              count: places.length,
            })}
          </p>
        </div>
        <ShareButton
          path={path}
          title={t("creator.placesRecommended", { displayName })}
        />
      </header>
      <div className="recommendations-toolbar">
        <Input
          aria-label={t("creator.searchRecommendedPlaces")}
          placeholder={t("creator.searchPlacesOrAreas")}
          value={query}
          maxLength={100}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(20);
            listScroll.current = 0;
          }}
        />
        <div
          className="recommendations-view-switch"
          role="group"
          aria-label={t("creator.placeView")}
        >
          {(["list", "map"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={view === mode}
              aria-controls={
                mode === "list" ? "recommendations-list" : "recommendations-map"
              }
              onClick={() => changeView(mode)}
            >
              {mode === "list" ? <List size={15} /> : <MapIcon size={15} />}
              {mode === "list" ? t("creator.list") : t("creator.map")}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="profile-feedback">
          {error}
        </p>
      )}
      <p className="recommendations-count">
        {t("creator.recommendationCount", { count: filtered.length })}
      </p>
      <div
        ref={list}
        id="recommendations-list"
        className="recommendations-list"
        hidden={view !== "list"}
        aria-label={t("creator.recommendedPlaces")}
      >
        <MobilePlaceList
          places={filtered.slice(0, limit)}
          selected={selected}
          active={view === "list" && !detail}
          demo={false}
          busy={busy}
          isSaved={saved}
          onOpen={open}
          onSave={(id) => void save(id)}
        />
        {limit < filtered.length && (
          <button
            className="recommendations-more"
            onClick={() => setLimit((value) => value + 20)}
          >
            {t("creator.showMoreCount", {
              shown: Math.min(limit, filtered.length),
              total: filtered.length,
            })}
          </button>
        )}
        {!filtered.length && (
          <p className="recommendations-empty">
            {places.length
              ? t("creator.noPlacesMatchYourSearch")
              : t("creator.noPublicRecommendationsYet")}
          </p>
        )}
      </div>
      <div
        id="recommendations-map"
        className={`recommendations-map ${current ? "has-detail" : ""}`}
        hidden={view !== "map"}
        aria-label={t("creator.recommendedPlacesMap")}
      >
        <div className="recommendations-map-canvas">
          {filtered.length ? (
            <MapCanvas
              config={config}
              places={filtered}
              selected={selected}
              onSelect={open}
              bounds={bounds}
              onBoundsChange={setBounds}
              focusRequest={focus}
              stationFocus={stationFocus}
              onFallback={() => changeView("list")}
            />
          ) : (
            <p className="recommendations-empty">
              {t("creator.noRecommendedPlacesToShow")}
            </p>
          )}
        </div>
        {current && (
          <PlaceDetail
            mapTitle={current.source_map_title}
            key={current.id}
            place={current}
            userLocation={null}
            onClose={() => setDetail(null)}
            onViewMap={() => {
              setDetail(null);
              changeView("map");
              setFocus((value) => value + 1);
            }}
            viewer={viewer}
            loginHref={loginHref(path)}
            vote={myState.votes[current.id] || 0}
            saved={saved(current.id)}
            onChange={() => {
              setSaveOverrides({});
              router.refresh();
            }}
            demo={false}
            creator={current.source_map_kind === "creator"}
            sharePath={`/maps/${current.source_map_slug}?place=${current.place_id}`}
            onStationSelect={(station) => {
              setStationFocus({ station, place: current });
              setDetail(null);
              changeView("map");
            }}
          />
        )}
      </div>
    </main>
  );
}
