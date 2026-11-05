import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createThumbnailQueue } from "@/components/community/place-thumbnail-queue";

let pending: {
  signal: AbortSignal;
  ids: string[];
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
}[];
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  pending = [];
  fetcher = vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const signal = options.signal as AbortSignal;
        signal.addEventListener("abort", () => reject(new Error("aborted")));
        pending.push({
          signal,
          ids: JSON.parse(options.body as string).placeIds,
          resolve,
          reject,
        });
      }),
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const tick = () => vi.advanceTimersByTimeAsync(16);
const finish = async (index: number) => {
  const batch = pending[index];
  batch.resolve(
    Response.json({
      previews: Object.fromEntries(batch.ids.map((id) => [id, `photo-${id}`])),
    }),
  );
  await vi.advanceTimersByTimeAsync(0);
};

test("coalesces ten requests over 16ms into one metadata request", async () => {
  const queue = createThumbnailQueue();
  const results = vi.fn();
  for (let i = 0; i < 10; i++) queue.load(String(i), results);
  expect(fetcher).not.toHaveBeenCalled();
  await tick();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe("/api/places/photos/previews");
  expect(pending[0].ids).toHaveLength(10);
  await finish(0);
  expect(results).toHaveBeenCalledTimes(10);
  queue.dispose();
});

test("caps batches at 50 and concurrent requests at two", async () => {
  const queue = createThumbnailQueue();
  const listener = vi.fn();
  for (let i = 0; i < 121; i++) queue.load(String(i), listener);
  await tick();
  expect(pending).toHaveLength(2);
  expect(pending.map((x) => x.ids.length)).toEqual([50, 50]);
  await finish(0);
  await tick();
  expect(pending[2].ids).toHaveLength(21);
  queue.dispose();
  await vi.advanceTimersByTimeAsync(0);
});

test("shares pending and in-flight requests and cancels only one subscriber", async () => {
  const queue = createThumbnailQueue();
  const a = vi.fn(),
    b = vi.fn(),
    c = vi.fn();
  const cancel = queue.load("same", a);
  queue.load("same", b);
  await tick();
  queue.load("same", c);
  cancel();
  expect(pending[0].signal.aborted).toBe(false);
  await finish(0);
  expect(a).not.toHaveBeenCalled();
  expect(b).toHaveBeenCalledWith("photo-same");
  expect(c).toHaveBeenCalledWith("photo-same");
  expect(fetcher).toHaveBeenCalledOnce();
  queue.dispose();
});

test("skips cancelled queued work and aborts a batch only after its last subscriber leaves", async () => {
  const queue = createThumbnailQueue();
  const listener = vi.fn();
  queue.load("skip", listener)();
  const a = queue.load("a", listener),
    b = queue.load("b", listener);
  await tick();
  expect(pending[0].ids).toEqual(["a", "b"]);
  a();
  expect(pending[0].signal.aborted).toBe(false);
  b();
  expect(pending[0].signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(listener).not.toHaveBeenCalled();
  queue.dispose();
});

test("a cancelled place can be reloaded while its old batch is still active", async () => {
  const queue = createThumbnailQueue();
  const old = vi.fn(),
    fresh = vi.fn();
  const cancel = queue.load("a", old);
  queue.load("b", vi.fn());
  await tick();
  cancel();
  queue.load("a", fresh);
  await tick();
  await finish(0);
  expect(fresh).not.toHaveBeenCalled();
  await finish(1);
  expect(fresh).toHaveBeenCalledWith("photo-a");
  expect(old).not.toHaveBeenCalled();
  queue.dispose();
});

test.each(["http", "network", "malformed"])(
  "returns null on %s failure and permits a later retry",
  async (mode) => {
    const queue = createThumbnailQueue();
    const listener = vi.fn();
    queue.load("a", listener);
    await tick();
    if (mode === "http") pending[0].resolve(new Response("", { status: 500 }));
    else if (mode === "network") pending[0].reject(new Error("offline"));
    else pending[0].resolve(new Response("invalid json"));
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledWith(null);
    queue.load("a", listener);
    await tick();
    await finish(1);
    expect(listener).toHaveBeenLastCalledWith("photo-a");
    queue.dispose();
  },
);

test("dispose cancels timers and active requests, suppresses delivery, and allows a fresh list", async () => {
  const queue = createThumbnailQueue();
  const listener = vi.fn();
  queue.load("a", listener);
  await tick();
  queue.load("b", listener);
  queue.dispose();
  await tick();
  expect(pending[0].signal.aborted).toBe(true);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(listener).not.toHaveBeenCalled();
  queue.load("c", listener);
  await tick();
  expect(fetcher).toHaveBeenCalledOnce();
  const next = createThumbnailQueue();
  next.load("a", listener);
  await tick();
  await finish(1);
  expect(listener).toHaveBeenCalledWith("photo-a");
  next.dispose();
});
