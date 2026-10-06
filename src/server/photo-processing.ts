import "server-only";
import sharp from "sharp";
import { PHOTO_TYPES, PHOTO_UPLOAD_LIMIT } from "@/domain/place-photo";
import { HttpError } from "./http";
export async function processPhoto(buffer: Buffer, contentType: string) {
  if (
    !PHOTO_TYPES.includes(contentType) ||
    buffer.length > PHOTO_UPLOAD_LIMIT ||
    !buffer.length
  )
    throw new HttpError(
      "3MB 이하 JPG, PNG, WebP 이미지만 등록할 수 있습니다.",
      400,
    );
  try {
    const options = {
      limitInputPixels: 40_000_000,
      failOn: "warning" as const,
      animated: false,
    };
    const metadata = await sharp(buffer, options).metadata();
    const expected = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
    }[contentType];
    if (metadata.format !== expected || (metadata.pages ?? 1) > 1)
      throw new Error("Unsupported image");
    // Re-encoding without keepMetadata strips EXIF/GPS, while rotate honours orientation.
    const { data: image, info } = await sharp(buffer, options)
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumbnail = await sharp(image)
      .resize({
        width: 480,
        height: 480,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
    if (image.length > PHOTO_UPLOAD_LIMIT) throw new Error("Image too large");
    return { image, thumbnail, width: info.width, height: info.height };
  } catch {
    throw new HttpError(
      "사진을 읽을 수 없습니다. 정상적인 JPG, PNG, WebP 파일을 선택해 주세요.",
      400,
    );
  }
}
