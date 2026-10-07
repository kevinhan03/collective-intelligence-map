"use client";
import { useEffect, useState } from "react";
import { TrainFront } from "lucide-react";
import type { MapPlace, NearbyStations, RailStation } from "@/domain/types";
import { directionsUrl, formatDistance } from "@/domain/visit";

export function NearbyStationInfo({
  place,
  compact = false,
  demo,
  onSelect,
}: {
  place: MapPlace;
  compact?: boolean;
  demo: boolean;
  onSelect?: (station: RailStation) => void;
}) {
  const [result, setResult] = useState<NearbyStations | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/places/${place.place_id}/stations`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setResult)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [place.place_id, demo, retry]);
  if (demo) return null;
  if (error)
    return (
      <p className="text-xs text-muted-foreground">
        역 정보를 불러오지 못했어요.{" "}
        <button
          className="min-h-9 underline"
          onClick={() => {
            setError(false);
            setRetry((v) => v + 1);
          }}
        >
          재시도
        </button>
      </p>
    );
  if (!result)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        가까운 역을 찾고 있어요…
      </p>
    );
  if (result.status !== "ready")
    return (
      <p className="text-xs text-muted-foreground">
        {result.status === "preparing"
          ? "가까운 역 정보를 준비 중이에요."
          : "이 지역의 역 정보는 아직 제공하지 않아요."}
      </p>
    );
  if (!result.stations.length)
    return (
      <p className="text-xs text-muted-foreground">
        {compact
          ? "가까운 지하철·기차역이 없어요."
          : "직선거리 2km 안에 등록된 지하철·기차역이 없어요."}
      </p>
    );
  return (
    <section aria-label="가까운 지하철·기차역" className="space-y-2">
      {!compact && (
        <h3 className="text-sm font-semibold">가까운 지하철·기차역</h3>
      )}
      {(compact ? result.stations.slice(0, 1) : result.stations).map(
        (station) => (
          <div
            key={station.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
          >
            <button
              type="button"
              onClick={() => onSelect?.(station)}
              disabled={!onSelect}
              className="inline-flex min-h-9 items-center gap-1.5 text-left text-primary disabled:text-muted-foreground"
            >
              <TrainFront size={14} aria-hidden="true" /> {station.name}
              {!compact && (
                <> · 직선거리 {formatDistance(station.distance_m)}</>
              )}
            </button>
            {!compact && (
              <a
                className="inline-flex min-h-9 items-center underline"
                href={directionsUrl(place, station)}
                target="_blank"
                rel="noreferrer"
              >
                역에서 걸어가기
              </a>
            )}
          </div>
        ),
      )}
      {!compact && (
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="block text-[10px] text-muted-foreground"
        >
          역 정보 © OpenStreetMap contributors · 직선거리 기준
        </a>
      )}
    </section>
  );
}
