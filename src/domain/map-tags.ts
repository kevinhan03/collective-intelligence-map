import { z } from "zod";

export const mapTagSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(20),
});
export type MapTag = z.infer<typeof mapTagSchema>;
export const tagCatalogSchema = z.object({
  tags: z.array(mapTagSchema).max(30),
  canManage: z.boolean(),
});
export const tagIdsSchema = z
  .array(z.uuid())
  .max(10)
  .transform((ids) => [...new Set(ids)].sort());
export function normalizeTagName(value: string) {
  return value.normalize("NFKC").trim().replace(/^#+/, "");
}
export const tagNameSchema = z
  .string()
  .transform(normalizeTagName)
  .pipe(
    z
      .string()
      .min(1, "태그 이름을 입력해 주세요.")
      .max(20, "태그는 최대 20자입니다.")
      .regex(/^[^\s#]+$/u, "태그에는 공백이나 #을 넣을 수 없습니다."),
  );
export const tagCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: tagNameSchema }),
  z.object({ action: z.literal("rename"), id: z.uuid(), name: tagNameSchema }),
  z.object({ action: z.literal("archive"), id: z.uuid() }),
]);
export function matchesTags(
  place: { tag_ids?: string[] },
  selected: string[] = [],
) {
  return selected.every((id) => place.tag_ids?.includes(id));
}
