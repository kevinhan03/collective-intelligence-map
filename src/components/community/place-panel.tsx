"use client";
import { useCallback, useEffect, useRef, type ReactElement } from "react";
import { Dialog } from "radix-ui";
import { animateSheetFrom, sheetOrigin } from "./place-sheet-motion";
import { useMobile } from "@/hooks/use-mobile";

/** Mobile is modal; desktop keeps the map and list interactive. */
export function PlacePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactElement;
}) {
  const mobile = useMobile();
  const previousFocus = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const top = Math.max(24, window.innerHeight * 0.08);
      panel.current?.style.setProperty(
        "--sheet-available-height",
        `${Math.max(120, height - top)}px`,
      );
      if (panel.current)
        panel.current.style.top = `${(viewport?.offsetTop ?? 0) + top}px`;
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mobile]);
  const attachPanel = useCallback(
    (element: HTMLDivElement | null) => {
      panel.current?.getAnimations().forEach((animation) => animation.cancel());
      panel.current = element;
      if (!mobile || !element) return;
      const viewport = window.visualViewport;
      const top = Math.max(24, window.innerHeight * 0.08);
      element.style.setProperty(
        "--sheet-available-height",
        `${Math.max(120, (viewport?.height ?? window.innerHeight) - top)}px`,
      );
      element.style.top = `${(viewport?.offsetTop ?? 0) + top}px`;
      const card = document.querySelector<HTMLElement>(
        ".mobile-place-carousel",
      );
      const from = card?.getClientRects().length
        ? sheetOrigin(card)
        : { top: window.innerHeight, height: element.offsetHeight };
      animateSheetFrom(element, from);
    },
    [mobile],
  );
  if (!mobile) return children;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="place-detail-backdrop fixed inset-0 z-60 bg-black/55" />
        <Dialog.Content
          asChild
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (document.querySelector("[data-photo-dialog]"))
              event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (document.querySelector("[data-photo-dialog]"))
              event.preventDefault();
          }}
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previousFocus.current?.focus({ preventScroll: true });
          }}
        >
          <div ref={attachPanel} className="mobile-place-dialog">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
