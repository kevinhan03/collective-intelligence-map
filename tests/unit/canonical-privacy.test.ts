import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  visible: false,
  canonical: {
    placeId: "private-id",
    name: "비공개 후보",
    address: "주소",
    category: "기타",
    lat: 37,
    lng: 127,
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => ({
    rpc: async () => ({ data: mocks.canonical, error: null }),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: mocks.visible ? { id: "private-id" } : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
import { resolveExistingPlaceDetails } from "@/server/places/canonical-resolver";
it("never returns a provider-linked creator draft without caller RLS access", async () => {
  mocks.visible = false;
  expect(await resolveExistingPlaceDetails("overture", "source-id")).toBeNull();
  mocks.visible = true;
  expect(await resolveExistingPlaceDetails("overture", "source-id")).toEqual(
    mocks.canonical,
  );
});
