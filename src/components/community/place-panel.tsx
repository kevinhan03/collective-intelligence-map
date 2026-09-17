"use client";
import { useRef, type ReactElement } from "react";
import { Dialog } from "radix-ui";
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
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previousFocus.current?.focus({ preventScroll: true });
          }}
        >
          <div className="mobile-place-dialog">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
