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
  vi.spyOn(console, "warn").mockImplementation(() => {});
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
it("retries a transient role lookup and recovers the verified role", async () => {
  mocks.profile.mockResolvedValue({ data: profile, error: null, status: 200 });
  mocks.role
    .mockResolvedValueOnce({
      data: null,
      error: { code: "", message: "unavailable" },
      status: 503,
    })
    .mockResolvedValueOnce({ data: "admin", error: null, status: 200 });
  expect(await getViewer()).toMatchObject({ role: "admin" });
  expect(mocks.role).toHaveBeenCalledTimes(2);
  expect(mocks.profile).toHaveBeenCalledTimes(1);
  expect(console.error).not.toHaveBeenCalled();
});
it("handles repeated transport failures as a warning without exposing raw details", async () => {
  mocks.profile.mockResolvedValue({ data: profile, error: null, status: 200 });
  mocks.role.mockResolvedValue({
    data: "admin",
    error: { message: "secret transport details" },
    status: 0,
  });
  expect(await getViewer()).toMatchObject({ role: "member" });
  expect(mocks.role).toHaveBeenCalledTimes(2);
  expect(console.warn).toHaveBeenCalledWith("viewer_role_unavailable", {
    code: "transport_error",
    status: 0,
    category: "temporary",
    retried: true,
  });
  expect(console.error).not.toHaveBeenCalled();
});
it.each([
  [403, "42501"],
  [404, "PGRST202"],
])("does not retry persistent role failures (%s)", async (status, code) => {
  mocks.profile.mockResolvedValue({ data: profile, error: null, status: 200 });
  mocks.role.mockResolvedValue({ data: null, error: { code }, status });
  expect(await getViewer()).toMatchObject({ role: "member" });
  expect(mocks.role).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith("viewer_role_unavailable", {
    code,
    status,
    category: "permission_or_schema",
    retried: false,
  });
});
