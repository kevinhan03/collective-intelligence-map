import { z } from "zod";
export const PHOTO_SOURCE_LIMIT = 5 * 1024 * 1024;
export const PHOTO_UPLOAD_LIMIT = 3 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const photoInputSchema = z.object({
  id: z.uuid(),
  caption: z.string().trim().max(300).default(""),
});
export const photoCursorSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export type PlacePhoto = {
  id: string;
  place_id: string;
  author_id: string | null;
  handle: string;
  caption: string;
  width: number;
  height: number;
  created_at: string;
};
export type PhotoPage = { photos: PlacePhoto[]; nextCursor: string | null };
export function photoImageUrl(id: string, thumbnail = false) {
  return `/api/photos/${id}/image${thumbnail ? "?size=thumbnail" : ""}`;
}
