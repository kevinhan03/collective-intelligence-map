"use client";
import { useRef } from "react";

export function PlaceSheetHandle({
  stage,
  onExpand,
  onCollapse,
}: {
  stage: "collapsed" | "summary" | "detail";
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const lastWheel = useRef(0);
  const label =
    stage === "collapsed"
      ? "장소 카드 펼치기"
      : stage === "summary"
        ? "장소 상세 펼치기"
        : "장소 카드 요약으로 접기";
  return (
    <button
      type="button"
      className="place-sheet-handle"
      aria-label={label}
      aria-expanded={stage !== "collapsed"}
      title="위로 쓸어 펼치고 아래로 쓸어 접기"
      onClick={() => {
        if (stage === "detail") onCollapse?.();
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
