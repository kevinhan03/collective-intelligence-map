import { z } from "zod";
import { catalogCategories, type CatalogEditorial } from "./catalog-config";
import type { CatalogMap } from "./map-catalog";

export const catalogEditSchema = z
  .object({
    mapId: z.uuid(),
    version: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(80),
    category: z.enum(catalogCategories.map((c) => c.id)).nullable(),
    region: z.string().trim().max(60),
    aliases: z.array(z.string().trim().min(1).max(60)).max(20),
    imageId: z.uuid().nullable(),
    focalX: z.number().min(0).max(100),
    focalY: z.number().min(0).max(100),
  })
  .strict();
export const catalogBatchSchema = z
  .object({
    changes: z.array(catalogEditSchema).min(1).max(100),
  })
  .strict()
  .refine(
    ({ changes }) =>
      new Set(changes.map((c) => c.mapId)).size === changes.length,
    "같은 지도를 중복 적용할 수 없습니다.",
  );
export type CatalogEdit = z.infer<typeof catalogEditSchema>;
export type CatalogValue = CatalogEditorial & {
  imageId?: string | null;
  focalX?: number;
  focalY?: number;
};
export type CatalogSetting = {
  map_id: string;
  value: CatalogValue;
  version: number;
};
export type CatalogAdminSnapshot = {
  maps: CatalogMap[];
  settings: CatalogSetting[];
};
export function catalogImageUrl(id: string) {
  return `/api/catalog/images/${id}`;
}
export function editForMap(
  map: CatalogMap,
  setting?: CatalogSetting,
): CatalogEdit {
  const value = setting?.value ?? map.editorial;
  const focal = (value?.focalPoint ?? "50% 50%").match(/[\d.]+/g);
  return {
    mapId: map.id,
    version: setting?.version ?? 0,
    title: value?.title ?? map.displayTitle,
    category: value?.category ?? map.catalogCategory,
    region: value?.region ?? "",
    aliases: value?.aliases ?? [],
    imageId: value?.imageId ?? null,
    focalX: value?.focalX ?? Number(focal?.[0] ?? 50),
    focalY: value?.focalY ?? Number(focal?.[1] ?? 50),
  };
}
export function sameCatalogEdit(a: CatalogEdit, b: CatalogEdit) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function previewEditorial(
  base: CatalogValue | undefined,
  edit: CatalogEdit,
): CatalogValue {
  const replaced = edit.imageId !== (base?.imageId ?? null);
  return {
    ...base,
    title: edit.title,
    category: edit.category,
    region: edit.region,
    aliases: edit.aliases,
    imageId: edit.imageId,
    image: edit.imageId ? catalogImageUrl(edit.imageId) : (base?.image ?? ""),
    focalX: edit.focalX,
    focalY: edit.focalY,
    focalPoint: `${edit.focalX}% ${edit.focalY}%`,
    wholeSubject: replaced ? false : base?.wholeSubject,
    order: base?.order ?? Number.MAX_SAFE_INTEGER,
  };
}
export const catalogDraftKey = (userId: string) =>
  `ting:catalog-draft:${userId}`;
export const catalogDraftSchema = z.object({
  changes: z.array(catalogEditSchema).max(100),
});
