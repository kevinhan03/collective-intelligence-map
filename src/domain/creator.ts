import { z } from "zod";
import type { ThemeMap, MapPlace } from "./types";
export type CreatorMap = ThemeMap & {
  kind: "creator";
  owner_id: string;
  status: "draft" | "published" | "archived";
  position: number;
  cover_path: string | null;
  hidden_at: string | null;
};
export type CreatorProfile = {
  display_name: string;
  instagram: string;
  featured_map_id: string | null;
};
export type CreatorSnapshot = {
  profile: CreatorProfile | null;
  maps: CreatorMap[];
};
export type CreatorCatalogItem = {
  map: CreatorMap;
  handle: string;
  profile: CreatorProfile | null;
};
export type CreatorPlace = MapPlace & { position: number };
export function normalizeInstagramProfile(value: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    const match = url.pathname.match(/^\/([A-Za-z0-9_.]{1,30})\/?$/);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !match
    )
      return value;
    return `https://www.instagram.com/${match[1]}/`;
  } catch {
    return value;
  }
}
const mapId = z.uuid();
const text = {
  title: z.string().trim().min(1).max(80),
  description: z.string().max(500),
  country: z.enum(["KR", "JP", "world"]),
};
export const creatorCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...text }),
  z.object({ action: z.literal("update"), mapId, ...text }),
  z.object({
    action: z.literal("status"),
    mapId,
    status: z.enum(["draft", "published", "archived"]),
  }),
  z.object({
    action: z.literal("profile"),
    displayName: z.string().trim().max(80),
    bio: z.string().max(500),
    instagram: z
      .string()
      .max(500)
      .transform(normalizeInstagramProfile)
      .pipe(
        z
          .string()
          .regex(
            /^$|^https:\/\/www\.instagram\.com\/[A-Za-z0-9_.]{1,30}\/$/,
            "Instagram 프로필 주소를 입력해 주세요.",
          ),
      ),
    featuredMapId: z.union([z.uuid(), z.literal("")]),
  }),
  z.object({ action: z.literal("order_maps"), ids: z.array(mapId).max(100) }),
  z.object({
    action: z.literal("order_places"),
    mapId,
    ids: z.array(mapId).max(200),
  }),
  z.object({
    action: z.literal("edit_place"),
    mapId,
    id: mapId,
    rationale: z.string().trim().min(5).max(1000),
  }),
  z.object({ action: z.literal("remove_place"), mapId, id: mapId }),
  z.object({ action: z.literal("cover"), mapId, path: z.literal("") }),
  z.object({
    action: z.literal("report"),
    mapId,
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("resolve_creator_report"),
    id: mapId,
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("hide"),
    mapId,
    reason: z.string().trim().min(5).max(1000),
  }),
]);
