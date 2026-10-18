"use client";
import {
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type MouseEvent,
} from "react";

/** Swipe the card's text/header without taking over photo strips or actions. */
export function usePlaceSwipe(
  index: number,
  count: number,
  onMove: (direction: number) => void,
) {
  const start = useRef<{
    id: number;
    x: number;
    y: number;
    axis: "x" | "y" | null;
  } | null>(null);
  const moved = useRef(false);
  const exit = useRef<Animation[]>([]);
  const generation = useRef(0);
  const target = useRef<HTMLElement | null>(null);
  useLayoutEffect(
    () => () => {
      generation.current++;
      exit.current.forEach((animation) => animation.cancel());
      exit.current = [];
      start.current = null;
      target.current?.removeAttribute("data-place-dragging");
      target.current?.style.removeProperty("--place-swipe-offset");
    },
    [index],
  );
  const reset = (element: HTMLElement) => {
    element.removeAttribute("data-place-dragging");
    element.style.removeProperty("--place-swipe-offset");
    start.current = null;
  };
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary || event.button !== 0 || exit.current.length) return;
      moved.current = false;
      start.current = null;
      target.current = event.currentTarget;
      if (
        (event.target as Element).closest(
          "a, button:not(.place-sheet-handle), input, textarea, .place-sheet-photo-preview, .mobile-explorer-actions",
        )
      )
        return;
      start.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        axis: null,
      };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const origin = start.current;
      if (!origin || event.pointerId !== origin.id) return;
      const dx = event.clientX - origin.x,
        dy = event.clientY - origin.y;
      if (!origin.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 8)
        origin.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      if (origin.axis !== "x") return;
      if (!moved.current) {
        event.currentTarget
          .querySelectorAll<HTMLElement>(
            ".place-sheet-title-row, .mobile-place-meta, .mobile-place-summary",
          )
          .forEach((element) =>
            element.getAnimations().forEach((animation) => animation.cancel()),
          );
      }
      moved.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.setAttribute("data-place-dragging", "true");
      const available = dx < 0 ? index < count - 1 : index > 0;
      const offset = available
        ? Math.sign(dx) * Math.min(64, Math.abs(dx) * 0.45)
        : dx * 0.12;
      event.currentTarget.style.setProperty(
        "--place-swipe-offset",
        `${offset}px`,
      );
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const origin = start.current;
      if (!origin || event.pointerId !== origin.id) return;
      const dx = event.clientX - origin.x,
        dy = event.clientY - origin.y;
      if (
        origin.axis !== "x" ||
        Math.abs(dx) < 40 ||
        Math.abs(dx) <= Math.abs(dy) * 1.2
      ) {
        reset(event.currentTarget);
        return;
      }
      const direction = dx < 0 ? 1 : -1;
      const element = event.currentTarget;
      start.current = null;
      if (index + direction < 0 || index + direction >= count) {
        reset(element);
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        reset(element);
        onMove(direction);
        return;
      }
      // Finish moving the outgoing content before replacing it. Resetting the
      // drag first would visibly snap the old place back to its starting point.
      const token = ++generation.current;
      exit.current = Array.from(
        element.querySelectorAll<HTMLElement>(
          ".place-sheet-title-row, .mobile-place-meta, .mobile-place-slide[aria-hidden='false'] .mobile-place-summary",
        ),
      ).map((content) =>
        content.animate(
          [
            { transform: getComputedStyle(content).transform, opacity: 1 },
            { transform: `translateX(${-direction * 80}px)`, opacity: 0 },
          ],
          { duration: 120, easing: "ease-out", fill: "forwards" },
        ),
      );
      void Promise.all(exit.current.map((animation) => animation.finished))
        .then(() => {
          if (generation.current !== token) return;
          // Retain the finished exit until React commits the new selection.
          // Clearing it here exposes the old content for one frame.
          onMove(direction);
        })
        .catch(() => {
          if (generation.current === token) reset(element);
        });
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      reset(event.currentTarget);
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (moved.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        moved.current = false;
      }
    },
  };
}
