import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processPhoto } from "@/server/photo-processing";
import { photoInputSchema, PHOTO_UPLOAD_LIMIT } from "@/domain/place-photo";
import { commandSchema } from "@/domain/validation";
describe("place photos", () => {
  it("rejects corrupt, spoofed, oversized and unsupported uploads", async () => {
    const jpg = await sharp({
      create: { width: 16, height: 12, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer();
    await expect(processPhoto(jpg, "image/png")).rejects.toThrow(
      "사진을 읽을 수 없습니다",
    );
    await expect(
      processPhoto(Buffer.from("not an image"), "image/jpeg"),
    ).rejects.toThrow();
    await expect(
      processPhoto(Buffer.alloc(PHOTO_UPLOAD_LIMIT + 1), "image/jpeg"),
    ).rejects.toThrow();
    await expect(processPhoto(jpg, "image/svg+xml")).rejects.toThrow();
  });
  it("corrects orientation, bounds dimensions and removes EXIF from both variants", async () => {
    const original = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "blue" },
    })
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Artist: "private author" } })
      .jpeg()
      .toBuffer();
    const output = await processPhoto(original, "image/jpeg");
    expect(output.width).toBe(1000);
    expect(output.height).toBe(2000);
    const image = await sharp(output.image).metadata();
    const thumb = await sharp(output.thumbnail).metadata();
    expect(image.format).toBe("webp");
    expect(image.exif).toBeUndefined();
    expect(image.orientation).toBeUndefined();
    expect(thumb.exif).toBeUndefined();
    expect(Math.max(thumb.width!, thumb.height!)).toBeLessThanOrEqual(480);
  });
  it("bounds descriptions and accepts only the declared photo commands", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(photoInputSchema.parse({ id, caption: " hello " }).caption).toBe(
      "hello",
    );
    expect(
      photoInputSchema.safeParse({ id, caption: "a".repeat(301) }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        action: "report",
        target: "photo",
        id,
        reason: "unrelated photo",
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({ action: "hide_photo", id, reason: "bad" })
        .success,
    ).toBe(false);
  });
});
