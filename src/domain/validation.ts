import { z } from "zod";
export const boundsSchema = z
  .object({
    west: z.coerce.number().min(-180).max(180),
    east: z.coerce.number().min(-180).max(180),
    south: z.coerce.number().min(-90).max(90),
    north: z.coerce.number().min(-90).max(90),
  })
  .refine(
    (b) => b.south < b.north && b.west !== b.east,
    "올바른 지도 범위를 선택해 주세요.",
  );
export const searchSchema = z.object({
  mapId: z.uuid(),
  query: z.string().trim().min(2).max(100),
  external: z.boolean().default(false),
  session: z.uuid().optional(),
});
export const proposalSchema = z
  .object({
    mapId: z.uuid(),
    placeId: z.uuid().optional(),
    name: z.string().trim().max(120).default(""),
    address: z.string().trim().max(250).default(""),
    category: z.string().trim().max(40).default("패션"),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    rationale: z
      .string()
      .trim()
      .min(15, "추천 근거를 15자 이상 작성해 주세요.")
      .max(1000),
    sourceNote: z.string().trim().max(1000).default(""),
    candidateToken: z.string().max(3000).optional(),
  })
  .superRefine((v, c) => {
    if (
      !v.placeId &&
      (!v.name ||
        v.lat === undefined ||
        v.lng === undefined ||
        v.sourceNote.length < 15)
    )
      c.addIssue({
        code: "custom",
        message: "새 장소의 이름·좌표·독립적인 출처를 입력해 주세요.",
      });
  });
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("vote"),
    id: z.uuid(),
    value: z.number().int().min(-1).max(1),
  }),
  z.object({ action: z.literal("save"), id: z.uuid(), enabled: z.boolean() }),
  z.object({ action: z.literal("follow"), id: z.uuid(), enabled: z.boolean() }),
  z.object({
    action: z.literal("comment"),
    id: z.uuid(),
    body: z.string().trim().min(2).max(2000),
  }),
  z.object({ action: z.literal("delete_comment"), id: z.uuid() }),
  z.object({
    action: z.literal("report"),
    id: z.uuid(),
    target: z.enum(["map_place", "comment"]),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("profile"),
    handle: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/),
    bio: z.string().max(500),
    avatar_path: z.string().max(250).nullable().optional(),
  }),
  z.object({
    action: z.literal("moderate"),
    id: z.uuid(),
    status: z.enum(["approved", "rejected", "disputed", "archived"]),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("resolve_report"),
    id: z.uuid(),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("hide_comment"),
    id: z.uuid(),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("merge"),
    id: z.uuid(),
    targetId: z.uuid(),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("provider_settings"),
    provider: z.enum(["google", "kakao"]),
    enabled: z.boolean(),
    daily_limit: z.number().int().min(0).max(10000),
    monthly_limit: z.number().int().min(0).max(100000),
    monthly_budget_micros: z.number().int().min(0).max(1000000000),
  }),
]);
