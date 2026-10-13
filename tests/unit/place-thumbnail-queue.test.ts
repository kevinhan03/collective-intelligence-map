import { afterEach, expect, test, vi } from "vitest";
import { createThumbnailQueue } from "@/components/community/place-thumbnail-queue";
afterEach(() => vi.unstubAllGlobals());
test("limits requests to three, skips cancelled queued work and aborts on dispose", async () => {
  const pending: { signal: AbortSignal; resolve: (value: Response) => void }[] =
    [];
  const fetcher = vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise<Response>((resolve) =>
        pending.push({ signal: options.signal as AbortSignal, resolve }),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const queue = createThumbnailQueue();
  const delivered = vi.fn();
  for (let i = 0; i < 3; i++) queue.load(String(i), delivered);
  const cancel = queue.load("cancelled", delivered);
  queue.load("next", delivered);
  expect(fetcher).toHaveBeenCalledTimes(3);
  cancel();
  pending[0].resolve(Response.json({ photos: [{ id: "photo" }] }));
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
  expect(fetcher.mock.calls[3][0]).toContain("/next/photos");
  expect(delivered).toHaveBeenCalledWith("photo");
  queue.dispose();
  expect(pending.slice(1).every((request) => request.signal.aborted)).toBe(
    true,
  );
});
test("shares identical place requests and returns no thumbnail on failures", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const queue = createThumbnailQueue();
  const first = vi.fn(),
    second = vi.fn();
  const cancel = queue.load("same", first);
  queue.load("same", second);
  expect(fetcher).toHaveBeenCalledTimes(1);
  cancel();
  finish(new Response("", { status: 500 }));
  await vi.waitFor(() => expect(second).toHaveBeenCalledWith(null));
  expect(first).not.toHaveBeenCalled();
  queue.dispose();
});
