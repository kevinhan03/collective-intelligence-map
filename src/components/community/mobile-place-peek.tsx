"use client";
import { usePlaceSheetDrag } from "@/hooks/use-place-sheet-drag";
import { PlaceSheetHandle } from "./place-sheet-handle";

import { useI18n } from "@/i18n/client";
/** The top edge of the dismissed sheet stays available at the map's bottom. */
export function MobilePlacePeek({
  subject,
  onExpand,
}: {
  subject: string;
  onExpand: () => void;
}) {
  const { t } = useI18n();
  const expand = () => {
    onExpand();
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          ".mobile-place-carousel .place-sheet-handle, .mobile-place-overview .place-sheet-handle",
        )
        ?.focus({ preventScroll: true });
    });
  };
  const drag = usePlaceSheetDrag(expand);
  return (
    <section
      className="mobile-place-peek"
      aria-label={t("map.collapsedPlaceCard")}
      {...drag}
    >
      <PlaceSheetHandle stage="collapsed" subject={subject} onExpand={expand} />
    </section>
  );
}
