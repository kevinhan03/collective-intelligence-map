import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  loggedIn: false,
  cookie: "hash" as string | null,
  results: {} as Record<
    string,
    { data: unknown; error: { code: string } | null }
  >,
  rejected: new Set<string>(),
  setupError: false,
  activitySetupError: false,
  dbCalls: 0,
  tables: vi.fn(),
  service: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("@/server/anonymous-votes", () => ({
  storedAnonymousVoteHash: async () => mocks.cookie,
}));
vi.mock("@/lib/supabase/server", () => ({
  configured: () => true,
  db: async () => {
    mocks.dbCalls++;
    if (mocks.setupError || (mocks.activitySetupError && mocks.dbCalls > 1))
      throw new Error("secret-token raw transport error");
    return {
      auth: {
        getUser: async () => ({
          data: { user: mocks.loggedIn ? { id: "user" } : null },
        }),
      },
      rpc: async () => ({ data: "member", error: null, status: 200 }),
      from: (table: string) => {
        mocks.tables(table);
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({
            data: { handle: "tester", bio: "", avatar_path: null },
            error: null,
          }),
          then: (
            resolve: (r: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) =>
            (mocks.rejected.has(table)
              ? Promise.reject(new Error("secret-token"))
              : Promise.resolve(mocks.results[table])
            ).then(resolve, reject),
        };
        return chain;
      },
    };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceDb: () => {
    mocks.service();
    return {
      from: () => ({
        select: () => ({
          eq: async () => {
            if (mocks.rejected.has("anonymous"))
              throw new Error("secret-token");
            return mocks.results.anonymous;
          },
        }),
      }),
    };
  },
}));
import { getMyState } from "@/server/queries";
const full = { votes: { place: -1 }, saves: ["saved"], followed: true };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.loggedIn = false;
  mocks.cookie = "hash";
  mocks.setupError = false;
  mocks.activitySetupError = false;
  mocks.dbCalls = 0;
  mocks.rejected.clear();
  mocks.results = {
    anonymous: { data: [{ map_place_id: "place", value: 1 }], error: null },
    map_place_votes: {
      data: [{ map_place_id: "place", value: -1 }],
      error: null,
    },
    saves: { data: [{ map_place_id: "saved" }], error: null },
    map_follows: { data: [{ map_id: "map" }], error: null },
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});
it("restores anonymous votes and does not read account activity", async () => {
  expect(await getMyState("map")).toEqual({
    votes: { place: 1 },
    saves: [],
    followed: false,
  });
  expect(mocks.service).toHaveBeenCalledOnce();
  expect(mocks.tables).not.toHaveBeenCalled();
  mocks.cookie = null;
  expect(await getMyState("map")).toEqual({
    votes: {},
    saves: [],
    followed: false,
  });
  expect(mocks.service).toHaveBeenCalledOnce();
});
it.each(["map_place_votes", "saves", "map_follows"])(
  "preserves other activity when %s returns an error or rejects",
  async (table) => {
    mocks.loggedIn = true;
    expect(await getMyState("map")).toEqual(full);
    const expected = {
      ...full,
      ...(table === "map_place_votes"
        ? { votes: {} }
        : table === "saves"
          ? { saves: [] }
          : { followed: false }),
    };
    mocks.results[table] = { data: null, error: { code: "42501" } };
    expect(await getMyState("map")).toEqual(expected);
    mocks.rejected.add(table);
    expect(await getMyState("map")).toEqual(expected);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "secret-token",
    );
  },
);
it("keeps anonymous browsing available on query or identity failures without logging secrets", async () => {
  mocks.rejected.add("anonymous");
  expect(await getMyState("map")).toEqual({
    votes: {},
    saves: [],
    followed: false,
  });
  mocks.setupError = true;
  expect(await getMyState("map")).toEqual({
    votes: {},
    saves: [],
    followed: false,
  });
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    "secret-token",
  );
});

it("handles activity client setup failures without a rejected page promise", async () => {
  mocks.loggedIn = true;
  mocks.activitySetupError = true;
  expect(await getMyState("map")).toEqual({
    votes: {},
    saves: [],
    followed: false,
  });
  expect(mocks.dbCalls).toBe(2);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    "secret-token",
  );
});
it("handles anonymous error responses independently", async () => {
  mocks.results.anonymous = { data: null, error: { code: "42P01" } };
  expect(await getMyState("map")).toEqual({
    votes: {},
    saves: [],
    followed: false,
  });
  expect(console.error).toHaveBeenCalledWith("my_state_unavailable", {
    source: "anonymous_votes",
    code: "42P01",
  });
});
