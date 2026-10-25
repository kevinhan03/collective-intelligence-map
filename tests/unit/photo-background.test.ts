import { expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  queries: [] as {
    select: string;
    orders: [string, unknown][];
    filters: [string, unknown][];
    limit: number;
  }[],
}));
vi.mock("@/lib/supabase/public", () => ({
  publicDb: () => ({
    from: () => {
      const call = {
        select: "",
        orders: [] as [string, unknown][],
        filters: [] as [string, unknown][],
        limit: 0,
      };
      mocks.queries.push(call);
      const result = () => ({
        data:
          call.select === "id"
            ? { id: "oldest-public" }
            : [
                {
                  id: "newest-public",
                  width: 480,
                  height: 320,
                  profiles: { handle: "visitor" },
                  created_at: "2026-10-25",
                },
              ],
        error: null,
      });
      const query = {
        select: (fields: string) => {
          call.select = fields;
          return query;
        },
        eq: (field: string, value: unknown) => {
          call.filters.push([field, value]);
          return query;
        },
        order: (field: string, options: unknown) => {
          call.orders.push([field, options]);
          return query;
        },
        limit: (limit: number) => {
          call.limit = limit;
          return query;
        },
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  }),
}));
import { getPhotoPage } from "@/server/place-photos";
test("background is the oldest visible photo independent of newest-first gallery pagination", async () => {
  const result = await getPhotoPage("place", null);
  expect(result.backdropPhotoId).toBe("oldest-public");
  expect(result.photos[0].id).toBe("newest-public");
  const [gallery, backdrop] = mocks.queries;
  expect(gallery.orders).toEqual([
    ["created_at", { ascending: false }],
    ["id", { ascending: false }],
  ]);
  expect(backdrop.orders).toEqual([
    ["created_at", { ascending: true }],
    ["id", { ascending: true }],
  ]);
  expect(backdrop.filters).toContainEqual(["status", "visible"]);
  expect(backdrop.limit).toBe(1);
});
