"use client";
import { useRef } from "react";

import { useI18n } from "@/i18n/client";
export function PlaceSheetHandle({
  stage,
  onExpand,
  onCollapse,
  onActivate,
  subject: subjectLabel,
}: {
  stage: "collapsed" | "summary" | "detail";
  onExpand?: () => void;
  onCollapse?: () => void;
  onActivate?: () => void;
  subject?: string;
}) {
  const { t } = useI18n();
  const subject = subjectLabel ?? t("map.placeCard");
  const lastWheel = useRef(0);
  const label =
    stage === "collapsed"
      ? t("map.expand", { subject })
      : stage === "summary"
        ? subjectLabel === undefined
          ? t("map.expandPlaceDetails")
          : t("map.collapse", { subject })
        : t("map.collapseToSummary", { subject });
  return (
    <button
      type="button"
      className="place-sheet-handle"
      aria-label={label}
      aria-expanded={stage !== "collapsed"}
      title={t("map.swipeUpToExpandDown")}
      onClick={() => {
        if (onActivate) onActivate();
        else if (stage === "detail") onCollapse?.();
        else onExpand?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onExpand?.();
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onCollapse?.();
        }
      }}
      onWheel={(event) => {
        if (Math.abs(event.deltaY) < 8 || Date.now() - lastWheel.current < 450)
          return;
        lastWheel.current = Date.now();
        if (event.deltaY < 0) onExpand?.();
        else onCollapse?.();
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}
