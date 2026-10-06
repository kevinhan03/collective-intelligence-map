import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ profile: vi.fn(), role: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/server/anonymous-votes", () => ({
  storedAnonymousVoteHash: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  db: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "viewer-id" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }),
    }),
    rpc: mocks.role,
  }),
}));
import { getViewer } from "@/server/queries";
const profile = { handle: "tester", bio: "", avatar_path: null };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.role.mockResolvedValue({ data: "admin", error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
it("recovers from a transient profile failure", async () => {
  mocks.profile
    .mockResolvedValueOnce({
      data: null,
      error: { code: "", message: "fetch failed" },
      status: 0,
    })
    .mockResolvedValueOnce({ data: profile, error: null, status: 200 });
  expect(await getViewer()).toMatchObject({
    id: "viewer-id",
    handle: "tester",
    role: "admin",
  });
  expect(mocks.profile).toHaveBeenCalledTimes(2);
});
it("keeps public rendering available when the retry also fails", async () => {
  mocks.profile.mockResolvedValue({
    data: null,
    error: { code: "", message: "unavailable" },
    status: 503,
  });
  expect(await getViewer()).toBeNull();
  expect(mocks.profile).toHaveBeenCalledTimes(2);
});
it("does not retry permission failures or invent a missing profile", async () => {
  mocks.profile.mockResolvedValue({
    data: null,
    error: { code: "42501" },
    status: 403,
  });
  expect(await getViewer()).toBeNull();
  expect(mocks.profile).toHaveBeenCalledTimes(1);
  mocks.profile.mockResolvedValue({ data: null, error: null, status: 200 });
  expect(await getViewer()).toBeNull();
});
it("does not grant admin privileges when role lookup fails", async () => {
  mocks.profile.mockResolvedValue({ data: profile, error: null, status: 200 });
  mocks.role.mockResolvedValue({ data: "admin", error: { code: "503" } });
  expect(await getViewer()).toMatchObject({ role: "member" });
});
