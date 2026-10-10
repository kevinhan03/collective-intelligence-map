import type { ThemeMap } from "./types";

export function placePath(slug: string, placeId: string) {
  return `/maps/${encodeURIComponent(slug)}/places/${encodeURIComponent(placeId)}`;
}

export function mapSearchTitle(map: ThemeMap) {
  return [
    ...new Set(
      [map.city || map.country, ...map.tags, map.title].filter(Boolean),
    ),
  ].join(" · ");
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function publicOrigin(raw: string | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
