"use client";
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

export type PlaceSheetStage = "closed" | "collapsed" | "summary" | "detail";

/** Only attached to the handle/header: content scrolling remains native. */
export function usePlaceSheetDrag(
  onExpand?: () => void,
  onCollapse?: () => void,
  onHorizontal?: (direction: number) => void,
) {
  const origin = useRef<{
    x: number;
    y: number;
    time: number;
    target: HTMLElement;
  } | null>(null);
  const dragged = useRef(false);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const target = useRef<HTMLElement | null>(null);
  useEffect(
    () => () => {
      if (settling.current) clearTimeout(settling.current);
      target.current?.style.removeProperty("transform");
      target.current?.removeAttribute("data-dragging");
    },
    [],
  );
  function settle(callback?: () => void) {
    const element = target.current;
    element?.removeAttribute("data-dragging");
    if (callback) {
      if (element) {
        element.dataset.transitionTop = String(
          element.getBoundingClientRect().top,
        );
        element.style.removeProperty("transform");
      }
      callback();
      return;
    }
    if (element) element.style.transform = "translateY(0)";
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 280;
    settling.current = setTimeout(() => {
      element?.style.removeProperty("transform");
      settling.current = null;
    }, delay);
  }
  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0 || settling.current) return;
      if (
        (event.target as Element).closest(
          "a, button:not(.place-sheet-handle), input, textarea, summary",
        )
      )
        return;
      const element = event.currentTarget.closest<HTMLElement>(
        ".mobile-place-carousel, .mobile-place-overview, .mobile-place-dialog, .mobile-place-peek",
      );
      if (!element) return;
      target.current = element;
      origin.current = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        target: event.currentTarget,
      };
      dragged.current = false;
      (
        (event.target as Element).closest<HTMLElement>(".place-sheet-handle") ??
        event.currentTarget
      ).setPointerCapture(event.pointerId);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const start = origin.current;
      if (!start) return;
      const dy = event.clientY - start.y;
      const dx = event.clientX - start.x;
      if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx)) return;
      dragged.current = true;
      target.current?.setAttribute("data-dragging", "true");
      if (target.current) {
        target.current
          .getAnimations()
          .forEach((animation) => animation.cancel());
        const canMove = dy < 0 ? Boolean(onExpand) : Boolean(onCollapse);
        const distance = canMove
          ? Math.sign(dy) * (160 * (1 - Math.exp(-Math.abs(dy) / 160)))
          : dy * 0.15;
        target.current.style.transform = `translateY(${distance}px)`;
      }
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const start = origin.current;
      origin.current = null;
      if (!start) return;
      const dy = event.clientY - start.y;
      const dx = event.clientX - start.x;
      const speed = Math.abs(dy) / Math.max(1, performance.now() - start.time);
      const move =
        Math.abs(dy) >= 8 &&
        Math.abs(dy) > Math.abs(dx) &&
        (Math.abs(dy) >= 40 || speed >= 0.35);
      dragged.current =
        dragged.current || Math.max(Math.abs(dy), Math.abs(dx)) >= 8;
      const horizontal = Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy);
      settle(
        horizontal
          ? () => onHorizontal?.(dx < 0 ? 1 : -1)
          : move
            ? dy < 0
              ? onExpand
              : onCollapse
            : undefined,
      );
    },
    onPointerCancel() {
      origin.current = null;
      dragged.current = true;
      settle();
    },
    onClickCapture(event: ReactMouseEvent<HTMLElement>) {
      if (dragged.current) {
        event.preventDefault();
        event.stopPropagation();
        dragged.current = false;
      }
    },
  };
}
