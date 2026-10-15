import { expect, it } from "vitest";
import {
  creatorCommandSchema,
  normalizeInstagramProfile,
} from "@/domain/creator";
it("validates creator limits, scopes and Instagram profile URLs without trusting owner input", () => {
  const mapId = "dd000000-0000-4000-8000-000000000001";
  expect(
    creatorCommandSchema.safeParse({
      action: "create",
      title: "x".repeat(81),
      description: "",
      country: "KR",
    }).success,
  ).toBe(false);
  expect(
    creatorCommandSchema.safeParse({
      action: "create",
      title: "한국",
      description: "",
      country: "CN",
    }).success,
  ).toBe(false);
  expect(
    creatorCommandSchema.safeParse({
      action: "profile",
      displayName: "창작자",
      bio: "",
      instagram: "https://evil.example/",
      featuredMapId: "",
    }).success,
  ).toBe(false);
  expect(
    creatorCommandSchema.parse({
      action: "update",
      mapId,
      title: "지도",
      description: "",
      country: "world",
      owner_id: "other",
    }),
  ).not.toHaveProperty("owner_id");
  expect(
    creatorCommandSchema.safeParse({
      action: "edit_place",
      mapId,
      id: mapId,
      rationale: "x".repeat(1001),
    }).success,
  ).toBe(false);
});
it("lets creators save an empty introduction", () => {
  expect(
    creatorCommandSchema.parse({
      action: "edit_place",
      mapId: "dd000000-0000-4000-8000-000000000001",
      id: "dd000000-0000-4000-8000-000000000002",
      rationale: " ",
    }),
  ).toMatchObject({ rationale: "" });
});

it("normalizes copied Instagram profile links without asserting identity", () => {
  expect(
    normalizeInstagramProfile("https://instagram.com/creator?igsh=tracking"),
  ).toBe("https://www.instagram.com/creator/");
  expect(
    creatorCommandSchema.safeParse({
      action: "profile",
      displayName: "x",
      bio: "",
      instagram: "https://instagram.com/creator?igsh=tracking",
      featuredMapId: "",
    }).success,
  ).toBe(true);
  expect(
    creatorCommandSchema.safeParse({
      action: "profile",
      displayName: "x",
      bio: "",
      instagram: "https://instagram.com.evil.test/creator",
      featuredMapId: "",
    }).success,
  ).toBe(false);
});
