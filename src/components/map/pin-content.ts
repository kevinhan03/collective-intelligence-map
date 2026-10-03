export const thumbPath =
  "M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L11 2a3.13 3.13 0 0 1 4 3.88Z";

export function pinCount(positive: number) {
  return positive > 999 ? "999+" : String(positive);
}

export function appendPinLikes(element: HTMLElement, positive: number) {
  element.classList.add("map-pin-likes");
  element.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", thumbPath);
  svg.append(path);
  element.append(svg);
  if (positive > 0) {
    const count = document.createElement("span");
    count.textContent = pinCount(positive);
    element.append(count);
  }
}
