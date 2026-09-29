import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({ serviceDb: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/server/http", () => ({
  requireViewer: async () => ({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
  body: async (request: Request) => request.json(),
  dbError: (error: Error | null) => { if (error) throw error; },
  json: (data: unknown, status = 200) => ({ data, status }),
  failure: (error: Error) => ({ error: error.message, status: 400 }),
  HttpError: class HttpError extends Error {},
}));

import { POST } from "@/app/api/places/propose/route";

const request = () => new Request("http://localhost/api/places/propose", {
  method: "POST",
  body: JSON.stringify({
    mapId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    placeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    rationale: "좋은 장소입니다.",
  }),
});

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.revalidate.mockReset();
});

it("returns the actual approved result for an admin-created proposal", async () => {
  mocks.rpc.mockResolvedValue({ data: {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    placeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "approved",
    created: true,
  }, error: null });
  const result = await POST(request()) as unknown as { data: { status: string; created: boolean }; status: number };
  expect(result.status).toBe(201);
  expect(result.data).toMatchObject({ status: "approved", created: true });
  expect(mocks.rpc).toHaveBeenCalledWith("submit_proposal_result", expect.any(Object));
});

it("does not report an existing pending proposal as newly created", async () => {
  mocks.rpc.mockResolvedValue({ data: {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    placeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "pending",
    created: false,
  }, error: null });
  const result = await POST(request()) as unknown as { data: { status: string; created: boolean }; status: number };
  expect(result.status).toBe(200);
  expect(result.data).toMatchObject({ status: "pending", created: false });
});
