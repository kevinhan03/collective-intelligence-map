"use client";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import {
  animateSheetFrom,
  sheetOrigin,
} from "@/components/community/place-sheet-motion";

/** Animates a bottom sheet between its collapsed and expanded heights. */
export function useSheetStageMotion(
  card: RefObject<HTMLElement | null>,
  stage: string,
) {
  const previousGeometry = useRef<{ top: number; height: number } | null>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (
        element.hasAttribute("data-dragging") ||
        element
          .getAnimations()
          .some((animation) => animation.playState === "running")
      )
        return;
      const rect = element.getBoundingClientRect();
      previousGeometry.current = { top: rect.top, height: rect.height };
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [card]);
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    const current = sheetOrigin(element);
    if (previousGeometry.current && previousStage.current !== stage) {
      animateSheetFrom(element, {
        ...previousGeometry.current,
        top:
          current.top !== element.getBoundingClientRect().top
            ? current.top
            : previousGeometry.current.top,
      });
    }
    previousGeometry.current = {
      top: element.getBoundingClientRect().top,
      height: current.height,
    };
    previousStage.current = stage;
  }, [card, stage]);
}
