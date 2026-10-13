import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  visible: vi.fn(),
  identity: vi.fn(),
  select: vi.fn(),
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.visible }) }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({ from: () => ({ select: mocks.select }) }),
}));
import { publicCreatorIdentity } from "@/server/creator";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-only");
  mocks.select.mockReturnValue({ eq: () => ({ maybeSingle: mocks.identity }) });
});
it("requires a publicly readable base profile before privileged identity lookup", async () => {
  mocks.visible.mockResolvedValue({ data: null });
  expect(await publicCreatorIdentity("private-user")).toBeNull();
  expect(mocks.select).not.toHaveBeenCalled();
});
it("reads only display name and Instagram, including profiles without public maps", async () => {
  mocks.visible.mockResolvedValue({ data: { id: "user" } });
  mocks.identity.mockResolvedValue({
    data: {
      display_name: "이름",
      instagram: "https://www.instagram.com/name/",
    },
    error: null,
  });
  expect(await publicCreatorIdentity("user")).toMatchObject({
    display_name: "이름",
  });
  expect(mocks.select).toHaveBeenCalledWith("display_name,instagram");
});
it("keeps pre-migration public profiles available", async () => {
  mocks.visible.mockResolvedValue({ data: { id: "user" } });
  mocks.identity.mockResolvedValue({ data: null, error: { code: "PGRST205" } });
  expect(await publicCreatorIdentity("user")).toBeNull();
});
