import { beforeEach, expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
import {
  externalSearchLimitMessage,
  parseExternalSearchLimit,
} from "@/domain/proposal-search-cache";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  regional: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: mock.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({
    rpc: mock.reserve,
    from: () => ({
      select: () => ({
        eq: () => ({ in: async () => ({ data: [], error: null }) }),
      }),
    }),
  }),
}));
vi.mock("@/server/places/search-map", () => ({
  getSearchMap: async () => demoMap,
}));
vi.mock("@/server/places/provider-router", () => ({
  routeProvider: () => ({ name: "kakao", adapter: { search: mock.regional } }),
}));
vi.mock("@/server/places/gemini-search-alias", () => ({
  canTranslateJapanese: () => false,
  japaneseSearchAliases: vi.fn(),
}));
vi.mock("@/server/events", () => ({ productEvent: vi.fn() }));
import { searchPlaces } from "@/server/places/search-service";

const viewer = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  handle: "test",
  bio: "",
  avatar_path: null,
  role: "member" as const,
};
const place = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "등록된 가게",
  address: "서울",
  category: "",
  locality: "서울",
  lat: 37.5,
  lng: 127,
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.rpc.mockResolvedValue({ data: [place], error: null });
  mock.regional.mockResolvedValue([]);
});

it("parses the retry hint and the budget hint", () => {
  expect(parseExternalSearchLimit("retry_after_minutes=12")).toEqual({
    kind: "user",
    retryAfterMinutes: 12,
  });
  expect(parseExternalSearchLimit("provider_budget")).toEqual({
    kind: "budget",
  });
  expect(parseExternalSearchLimit(null)).toBeNull();
  expect(parseExternalSearchLimit("retry_after_minutes=")).toBeNull();
});

it("tells the user when external search reopens", () => {
  expect(
    externalSearchLimitMessage({ kind: "user", retryAfterMinutes: 12 }),
  ).toContain("약 12분 뒤");
  expect(
    externalSearchLimitMessage({ kind: "user", retryAfterMinutes: null }),
  ).toContain("잠시 후");
  expect(externalSearchLimitMessage({ kind: "budget" })).toContain("오늘은");
});

it("keeps internal matches when the hourly external cap is reached", async () => {
  mock.reserve.mockResolvedValue({
    data: null,
    error: {
      code: "P0001",
      message: "검색 요청 한도에 도달했습니다.",
      hint: "retry_after_minutes=7",
    },
  });
  const result = await searchPlaces(
    { mapId: demoMap.id, query: "등록된", external: true },
    viewer,
  );
  expect(mock.regional).not.toHaveBeenCalled();
  expect(result.internal.map((p) => p.id)).toEqual([place.id]);
  expect(result).toMatchObject({
    candidates: [],
    externalLimit: { kind: "user", retryAfterMinutes: 7 },
  });
});

it("still fails loudly for unrelated reservation errors", async () => {
  mock.reserve.mockResolvedValue({
    data: null,
    error: { code: "P0001", message: "Forbidden", hint: null },
  });
  await expect(
    searchPlaces({ mapId: demoMap.id, query: "등록", external: true }, viewer),
  ).rejects.toMatchObject({ status: 429, message: "Forbidden" });
});
