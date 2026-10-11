/** Geometry bridges the preview card and the modal without changing their focus semantics. */
export const sheetTiming: KeyframeAnimationOptions = {
  duration: 280,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};
export function reducedSheetMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
export function sheetOrigin(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const top = Number(element.dataset.transitionTop ?? rect.top);
  delete element.dataset.transitionTop;
  return { top, height: rect.height };
}
export function animateSheetFrom(
  element: HTMLElement,
  from: { top: number; height: number },
) {
  if (reducedSheetMotion()) return;
  const rect = element.getBoundingClientRect();
  element.animate(
    [
      {
        transform: `translateY(${from.top - rect.top}px)`,
        clipPath: `inset(0 0 ${Math.max(0, rect.height - from.height)}px 0 round 24px)`,
      },
      { transform: "translateY(0)", clipPath: "inset(0 0 0 0 round 24px)" },
    ],
    sheetTiming,
  );
}
const exiting = new WeakSet<HTMLElement>();
export function exitPlaceSheet(callback: () => void, close = false) {
  const panel = document.querySelector<HTMLElement>(".mobile-place-dialog");
  if (!panel || reducedSheetMotion()) {
    callback();
    return;
  }
  if (exiting.has(panel)) return;
  exiting.add(panel);
  panel.getAnimations().forEach((animation) => animation.cancel());
  const from = sheetOrigin(panel);
  const rect = panel.getBoundingClientRect();
  const card = document.querySelector<HTMLElement>(".mobile-place-carousel");
  const destination = card?.getClientRects().length
    ? card.getBoundingClientRect()
    : undefined;
  const top = close || !destination ? window.innerHeight : destination.top;
  const inset =
    close || !destination ? 0 : Math.max(0, rect.height - destination.height);
  const animation = panel.animate(
    [
      {
        transform: `translateY(${from.top - rect.top}px)`,
        clipPath: "inset(0 0 0 0 round 24px)",
      },
      {
        transform: `translateY(${top - rect.top}px)`,
        clipPath: `inset(0 0 ${inset}px 0 round 24px)`,
      },
    ],
    { ...sheetTiming, fill: "forwards" },
  );
  document
    .querySelector<HTMLElement>(".place-detail-backdrop")
    ?.animate([{ opacity: 1 }, { opacity: 0 }], {
      ...sheetTiming,
      fill: "forwards",
    });
  animation.finished.then(callback).catch(() => {
    exiting.delete(panel);
  });
}
