"use client";

import Link from "@/i18n/link";
import { Bookmark, ChevronUp, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NearbyStationInfo } from "./nearby-stations";
import type { MapPlace, RailStation } from "@/domain/types";
import { placeArea } from "@/domain/place-location";

import { useI18n } from "@/i18n/client";
export function PlacePreview({
  place,
  saved,
  vote,
  demo,
  creator = false,
  signedIn,
  loginHref,
  busy,
  votePending = false,
  savePending = false,
  onClose,
  onOpenDetail,
  onVote,
  onSave,
  onStationSelect,
}: {
  place: MapPlace;
  saved: boolean;
  vote: number;
  demo: boolean;
  creator?: boolean;
  signedIn: boolean;
  loginHref: string;
  busy: boolean;
  votePending?: boolean;
  savePending?: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onVote: (value: 1 | -1) => void;
  onSave: () => void;
  onStationSelect: (station: RailStation) => void;
}) {
  const { t } = useI18n();
  const total = place.positive + place.negative;
  return (
    <aside
      className="place-preview-card"
      aria-label={t("map.preview", { name: place.name })}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          className="min-w-0 text-left"
          onClick={onOpenDetail}
          aria-label={t("map.viewDetails2", { name: place.name })}
        >
          {t.area(placeArea(place.address)) && (
            <span className="text-xs text-primary">
              {t.area(placeArea(place.address))}
            </span>
          )}
          <h2 className="mt-1 truncate text-lg font-semibold">{place.name}</h2>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("map.closePlacePreview")}
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      <NearbyStationInfo
        key={place.place_id}
        place={place}
        compact
        demo={demo}
        onSelect={onStationSelect}
      />
      {place.rationale && (
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
          {place.rationale}
        </p>
      )}
      {!creator && (
        <p className="mt-3 text-xs text-muted-foreground">
          {total
            ? t("map.ofPeopleSayItFits", { total, positive: place.positive })
            : t("map.thisPlaceHasnTBeen")}
        </p>
      )}
      {!creator && (
        <div
          className="place-card-votes mt-3 flex items-center gap-2"
          aria-label={t("map.themeFitVoteFor", { name: place.name })}
        >
          <button
            type="button"
            className="vote-control"
            aria-label={t("map.fitsTheTheme", {
              name: place.name,
              positive: place.positive,
            })}
            aria-pressed={vote === 1}
            disabled={demo || busy || votePending}
            onClick={() => onVote(1)}
          >
            <ThumbsUp size={14} fill="none" strokeWidth={1.8} />
            <span>{place.positive}</span>
          </button>
          <button
            type="button"
            className="vote-control"
            aria-label={t("map.doesnTFitTheTheme", {
              name: place.name,
              negative: place.negative,
            })}
            aria-pressed={vote === -1}
            disabled={demo || busy || votePending}
            onClick={() => onVote(-1)}
          >
            <ThumbsDown size={14} fill="none" strokeWidth={1.8} />
            <span>{place.negative}</span>
          </button>
        </div>
      )}
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Button className="h-11" onClick={onOpenDetail}>
          {t("map.viewDetails3")}
          <ChevronUp size={17} />
        </Button>
        {demo ? (
          <Button
            className="h-11"
            variant="outline"
            disabled
            aria-label={t("map.youCanTSaveIn")}
          >
            <Bookmark size={17} />
          </Button>
        ) : signedIn ? (
          <Button
            className="h-11"
            variant={saved ? "secondary" : "outline"}
            disabled={busy || savePending}
            aria-pressed={saved}
            aria-label={
              saved
                ? t("map.unsave2", { name: place.name })
                : t("map.save2", { name: place.name })
            }
            onClick={onSave}
          >
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
            <span className="sr-only">
              {saved ? t("map.unsave") : t("map.save")}
            </span>
          </Button>
        ) : (
          <Button asChild className="h-11" variant="outline">
            <Link href={loginHref} aria-label={t("map.signInToSavePlaces")}>
              <Bookmark size={17} />
            </Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
