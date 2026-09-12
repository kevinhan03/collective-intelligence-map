import { expect, it, vi } from "vitest";
import { demoMap } from "@/server/demo";
const mocks = vi.hoisted(() => ({
  resolve: vi.fn().mockResolvedValue(null),
  details: vi.fn(async (candidate: { externalId: string }) => ({
    ...candidate,
    label: "빈티지 숍",
    address: "부산",
    lat: 35.16,
    lng: 129.06,
  })),
}));
vi.mock("@/server/queries", () => ({
  getMaps: async () => [{ ...demoMap, country: "KR" }],
}));
vi.mock("@/server/places/canonical-resolver", () => ({
  resolveExistingPlaceDetails: mocks.resolve,
}));
vi.mock("@/server/places/provider-router", () => ({
  routeProvider: () => ({
    name: "google",
    adapter: { details: mocks.details },
  }),
}));
vi.mock("@/server/places/usage", () => ({
  metered: async (_args: unknown, run: () => unknown) => run(),
}));
import { selectCandidate } from "@/server/places/search-service";
import {
  signCandidate,
  verifyCandidate,
} from "@/server/places/candidate-token";

it("keeps a Google selection intact through signed submission", async () => {
  vi.stubEnv("PROVIDER_SIGNING_SECRET", "x".repeat(32));
  try {
    const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const token = signCandidate({
      provider: "google",
      externalId: "123",
      userId: user,
      mapId: demoMap.id,
      session: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      expires: Date.now() + 60000,
      selected: false,
    });
    const result = await selectCandidate(token, demoMap.id, {
      id: user,
      role: "contributor",
      handle: "tester",
      bio: "",
      avatar_path: null,
    });
    expect(result.candidate).toMatchObject({
      label: "빈티지 숍",
      address: "부산",
      lat: 35.16,
      lng: 129.06,
    });
    expect(
      verifyCandidate(result.candidate.token!, user, demoMap.id),
    ).toMatchObject({ name: "빈티지 숍", lat: 35.16, lng: 129.06 });
  } finally {
    vi.unstubAllEnvs();
  }
});

it("skips the paid provider call when the place was already resolved", async () => {
  vi.stubEnv("PROVIDER_SIGNING_SECRET", "x".repeat(32));
  mocks.resolve.mockResolvedValueOnce({
    placeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "이미 승인된 편집숍",
    address: "서울",
    category: "빈티지",
    lat: 37.55,
    lng: 126.99,
  });
  mocks.details.mockClear();
  try {
    const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const token = signCandidate({
      provider: "google",
      externalId: "456",
      userId: user,
      mapId: demoMap.id,
      session: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      expires: Date.now() + 60000,
      selected: false,
    });
    const result = await selectCandidate(token, demoMap.id, {
      id: user,
      role: "contributor",
      handle: "tester",
      bio: "",
      avatar_path: null,
    });
    expect(mocks.details).not.toHaveBeenCalled();
    expect(result.placeId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(result.candidate).toMatchObject({
      label: "이미 승인된 편집숍",
      address: "서울",
      lat: 37.55,
      lng: 126.99,
    });
  } finally {
    vi.unstubAllEnvs();
  }
});
