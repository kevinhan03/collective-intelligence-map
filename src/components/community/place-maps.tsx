"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/link";
import { ArrowUpRight } from "lucide-react";
import type { PlaceMap } from "@/domain/types";
import { formatLocation } from "@/domain/location";
import styles from "./place-maps.module.css";

import { useI18n } from "@/i18n/client";
export function PlaceMaps({
  placeId,
  currentMapId,
}: {
  placeId: string;
  currentMapId: string;
}) {
  const { t } = useI18n();
  const [maps, setMaps] = useState<PlaceMap[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/places/${placeId}/maps`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ maps: PlaceMap[] }>;
      })
      .then(({ maps }) => {
        if (!controller.signal.aborted) setMaps(maps);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [placeId, attempt]);

  const sorted = maps?.toSorted(
    (a, b) =>
      Number(b.id === currentMapId) - Number(a.id === currentMapId) ||
      a.title.localeCompare(b.title, "ko"),
  );

  return (
    <section
      className={styles.section}
      aria-label={t("place.mapsWithThisPlace")}
    >
      <h3 className={styles.heading}>
        {t("place.mapsWithThisPlace")}
        {maps && <span>{maps.length}</span>}
      </h3>
      {error ? (
        <div className={styles.status} role="status">
          <p>{t("place.couldnTLoadMaps")}</p>
          <button
            type="button"
            className="mt-1 min-h-11 text-primary underline"
            onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            {t("place.tryAgain")}
          </button>
        </div>
      ) : !sorted ? (
        <p className={styles.status} role="status">
          {t("place.loadingMaps")}
        </p>
      ) : !sorted.length ? (
        <p className={styles.status}>{t("place.notOnAnyPublicMap")}</p>
      ) : (
        <ul className={styles.list}>
          {sorted.map((map) => (
            <li key={map.id}>
              <Link
                href={`/maps/${map.slug}?place=${encodeURIComponent(placeId)}`}
                className={styles.card}
                data-current={map.id === currentMapId}
                prefetch={false}
              >
                <div className={styles.body}>
                  <p className={styles.meta}>
                    <span>{t.area(formatLocation(map))}</span>
                    {map.id === currentMapId && (
                      <span className={styles.currentBadge}>
                        {t("place.currentMap")}
                      </span>
                    )}
                  </p>
                  <h4>{map.title}</h4>
                  {map.tags.some((tag) => tag !== "전체") && (
                    <p className={styles.tags}>
                      {map.tags
                        .filter((tag) => tag !== "전체")
                        .slice(0, 3)
                        .map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                    </p>
                  )}
                </div>
                <ArrowUpRight
                  size={20}
                  className={styles.arrow}
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
