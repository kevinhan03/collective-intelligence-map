"use client";
import { useEffect, useState } from "react";
import { TrainFront } from "lucide-react";
import type { MapPlace, NearbyStations, RailStation } from "@/domain/types";
import { directionsUrl, formatDistance } from "@/domain/visit";

import { useI18n } from "@/i18n/client";
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
  const { t } = useI18n();
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
        {t("map.couldnTLoadStationInfo")}{" "}
        <button
          className="min-h-9 underline"
          onClick={() => {
            setError(false);
            setRetry((v) => v + 1);
          }}
        >
          {t("map.retry")}
        </button>
      </p>
    );
  if (!result)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("map.findingNearbyStations")}
      </p>
    );
  if (result.status !== "ready")
    return (
      <p className="text-xs text-muted-foreground">
        {result.status === "preparing"
          ? t("map.nearbyStationInfoIsBeing")
          : t("map.stationInfoIsnTAvailable")}
      </p>
    );
  if (!result.stations.length)
    return (
      <p className="text-xs text-muted-foreground">
        {compact
          ? t("map.noNearbySubwayOrTrain")
          : t("map.noSubwayOrTrainStations")}
      </p>
    );
  return (
    <section aria-label={t("map.nearbyStations")} className="space-y-2">
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
                <>
                  {" "}
                  {t("map.straightLineDistance", {
                    distance: formatDistance(station.distance_m),
                  })}
                </>
              )}
            </button>
            {!compact && (
              <a
                className="inline-flex min-h-9 items-center underline"
                href={directionsUrl(place, station)}
                target="_blank"
                rel="noreferrer"
              >
                {t("map.walkFromTheStation")}
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
          {t("map.stationDataOpenstreetmapContributorsStraight")}
        </a>
      )}
    </section>
  );
}
