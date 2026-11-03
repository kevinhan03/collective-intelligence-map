import { afterEach, expect, test, vi } from "vitest";
vi.mock("@/server/queries", () => ({ getViewer: vi.fn() }));
import { body } from "@/server/http";
afterEach(() => vi.unstubAllEnvs());
function request(data: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/community", {
    method: "POST",
    headers: { origin: "http://localhost", ...headers },
    body: data,
    duplex: "half",
  } as RequestInit);
}
test("keeps character limits for ASCII and multibyte JSON", async () => {
  const raw = JSON.stringify({ text: "한글😀" });
  expect(await body(request(raw), raw.length)).toEqual({ text: "한글😀" });
  await expect(body(request(raw), raw.length - 1)).rejects.toMatchObject({
    status: 413,
  });
  expect(await body(request("1234"), 4)).toBe(1234);
  await expect(body(request("12345"), 4)).rejects.toMatchObject({
    status: 413,
  });
});
test("cancels oversized chunked bodies early even with a false content length", async () => {
  for (const headers of [{}, { "content-length": "1" }] as Record<
    string,
    string
  >[]) {
    let sent = 0;
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024).fill(32));
        sent += 1024;
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(body(request(stream, headers), 12000)).rejects.toMatchObject({
      status: 413,
    });
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThan(20 * 1024);
  }
});
test("rejects an oversized declared length before reading", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  await expect(
    body(request(stream, { "content-length": "48001" })),
  ).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
});
test("UTF-8 split chunks decode correctly and encoded bytes are bounded", async () => {
  const raw = JSON.stringify({ text: "한😀" });
  const bytes = new TextEncoder().encode(raw);
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, ++offset));
    },
  });
  expect(await body(request(stream), raw.length)).toEqual({ text: "한😀" });
  // Incomplete sequences cannot evade the independent byte limit.
  const incomplete = new Uint8Array(13).fill(0x80);
  await expect(body(request(incomplete), 3)).rejects.toMatchObject({
    status: 413,
  });
});
test("rejects malformed, empty and foreign-origin bodies", async () => {
  for (const raw of ["{", "", null])
    await expect(body(request(raw))).rejects.toMatchObject({ status: 400 });
  await expect(
    body(request("{}", { origin: "https://evil.test" })),
  ).rejects.toMatchObject({ status: 403 });
});
