import {
  PHOTO_SOURCE_LIMIT,
  PHOTO_TYPES,
  PHOTO_UPLOAD_LIMIT,
} from "@/domain/place-photo";
/** Decode with browser orientation handling and re-encode to a bounded JPEG upload. */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!PHOTO_TYPES.includes(file.type) || file.size > PHOTO_SOURCE_LIMIT)
    throw new Error("5MB 이하 JPG, PNG, WebP 파일을 선택해 주세요.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("사진을 읽을 수 없습니다. 다른 사진을 선택해 주세요.");
  }
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서 사진을 처리할 수 없습니다.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= PHOTO_UPLOAD_LIMIT) return blob;
    }
    throw new Error(
      "사진 용량을 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.",
    );
  } finally {
    bitmap.close();
  }
}
