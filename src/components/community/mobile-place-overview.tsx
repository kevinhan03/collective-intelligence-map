"use client";
import { useRef, type ComponentProps, type ReactNode } from "react";
import { X } from "lucide-react";
import { PlaceSheetHandle } from "./place-sheet-handle";
import { MobilePlaceList } from "./mobile-place-list";
import { usePlaceSheetDrag } from "@/hooks/use-place-sheet-drag";
import { useSheetStageMotion } from "@/hooks/use-sheet-stage-motion";

type ListProps = ComponentProps<typeof MobilePlaceList>;

/** Bottom sheet shown before a place is picked: every place on the map. */
export function MobilePlaceOverview({
  stage,
  onStageChange,
  onClose,
  controls,
  ...list
}: Pick<
  ListProps,
  | "places"
  | "demo"
  | "busy"
  | "isSavePending"
  | "isSaved"
  | "onOpen"
  | "onSave"
  | "station"
> & {
  stage: "collapsed" | "summary";
  onStageChange: (stage: "collapsed" | "summary") => void;
  onClose: () => void;
  controls: ReactNode;
}) {
  const card = useRef<HTMLElement>(null);
  useSheetStageMotion(card, stage);
  const expand = () => onStageChange("summary");
  const collapse = () => onStageChange("collapsed");
  const drag = usePlaceSheetDrag(
    stage === "collapsed" ? expand : undefined,
    stage === "summary" ? collapse : undefined,
  );
  return (
    <section
      ref={card}
      className="mobile-place-overview"
      data-sheet-stage={stage}
      aria-label="장소 목록"
    >
      <div className="place-sheet-drag-zone" {...drag}>
        <PlaceSheetHandle
          stage={stage}
          subject="장소 목록"
          onActivate={stage === "collapsed" ? expand : collapse}
          onExpand={expand}
          onCollapse={collapse}
        />
        <div className="place-sheet-title-row">
          <h2 className="place-sheet-title">{list.places.length}곳</h2>
          <button
            className="place-sheet-close"
            aria-label="장소 목록 닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {stage === "collapsed" && (
          <p className="place-sheet-intro">위로 올려 전체 장소 보기</p>
        )}
      </div>
      {stage === "summary" && (
        <div className="mobile-place-overview-list">
          <MobilePlaceList {...list} selected={null} active />
        </div>
      )}
      <div className="mobile-explorer-actions">{controls}</div>
    </section>
  );
}
