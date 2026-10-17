import { afterEach, expect, test, vi } from "vitest";
import { PlaceResourceCache } from "@/components/community/place-resource-cache";
afterEach(() => vi.useRealTimers());
test("deduplicates concurrent readers and reuses fresh data", async () => {
  const cache = new PlaceResourceCache();
  const fetcher = vi.fn(async () => ({ total: 1 }));
  const notify = vi.fn();
  const unsubscribe = cache.subscribe("comments:a", notify);
  const first = cache.load("comments:a", fetcher);
  expect(cache.load("comments:a", fetcher)).toBe(first);
  await first;
  await cache.load("comments:a", fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(cache.snapshot("comments:a").data).toEqual({ total: 1 });
  expect(notify).toHaveBeenCalledTimes(2);
  unsubscribe();
});
test("retains stale data while revalidating and on failure, then permits retry", async () => {
  vi.useFakeTimers();
  const cache = new PlaceResourceCache();
  await cache.load("photos:a", async () => ["old"]);
  vi.advanceTimersByTime(30_001);
  let reject!: (reason: Error) => void;
  const request = cache.load(
    "photos:a",
    () =>
      new Promise<string[]>((_, fail) => {
        reject = fail;
      }),
  );
  expect(cache.snapshot("photos:a")).toMatchObject({
    data: ["old"],
    loading: true,
  });
  await Promise.resolve();
  reject(new Error("offline"));
  await expect(request).rejects.toThrow("offline");
  expect(cache.snapshot("photos:a")).toMatchObject({
    data: ["old"],
    error: "offline",
    loading: false,
  });
  await cache.load("photos:a", async () => ["new"]);
  expect(cache.snapshot("photos:a").data).toEqual(["new"]);
});
test("a forced reload supersedes old responses and preserves page merges", async () => {
  const cache = new PlaceResourceCache();
  let complete!: (data: number[]) => void;
  const old = cache.load(
    "a",
    () =>
      new Promise<number[]>((resolve) => {
        complete = resolve;
      }),
  );
  await Promise.resolve();
  await cache.load("a", async () => [2], { force: true });
  complete([1]);
  await old;
  await cache.load<number[]>("a", async () => [3], {
    force: true,
    merge: (previous, page) => [...(previous ?? []), ...page],
  });
  expect(cache.snapshot("a").data).toEqual([2, 3]);
});
test("viewer caches are isolated and disposal aborts pending requests", async () => {
  const first = new PlaceResourceCache("viewer-a"),
    second = new PlaceResourceCache("viewer-b");
  await first.load("a", async () => ({ liked: true }));
  expect(second.snapshot("a").data).toBeUndefined();
  let signal!: AbortSignal;
  const pending = first.load("b", async (current) => {
    signal = current;
    return new Promise(() => {});
  });
  void pending;
  await Promise.resolve();
  first.dispose();
  expect(signal.aborted).toBe(true);
});
test("shared local updates notify all readers without changing other places", async () => {
  const cache = new PlaceResourceCache();
  await cache.load("a", async () => ({ liked: false }));
  const a = vi.fn(),
    b = vi.fn();
  cache.subscribe("a", a);
  cache.subscribe("a", b);
  cache.update<{ liked: boolean }>("a", () => ({ liked: true }));
  expect(a).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
  expect(cache.snapshot("b").data).toBeUndefined();
});
test("a confirmed mutation cannot be overwritten by an older background read", async () => {
  const cache = new PlaceResourceCache();
  await cache.load("a", async () => ({ liked: false }));
  let complete!: (value: { liked: boolean }) => void;
  const background = cache.load(
    "a",
    () =>
      new Promise<{ liked: boolean }>((resolve) => {
        complete = resolve;
      }),
    { force: true },
  );
  await Promise.resolve();
  cache.update("a", () => ({ liked: true }));
  complete({ liked: false });
  await background;
  expect(cache.snapshot("a")).toMatchObject({
    data: { liked: true },
    loading: false,
  });
});
