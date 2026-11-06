import "server-only";
import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { ImageResponse } from "next/og";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";
import { serviceDb } from "@/lib/supabase/admin";
import type { ThemeMap } from "@/domain/types";
import {
  SHARE_CARD_SIZE,
  shareCardLabel,
  shareCardTitle,
} from "@/domain/share-card";
import { HomeShareCard, MapShareCard } from "./share-card-view";

const fonts = Promise.all([
  readFile(
    join(
      process.cwd(),
      "node_modules/@sun-typeface/suit/fonts/static/otf/SUIT-Regular.otf",
    ),
  ).then((bytes) => ({
    name: "SUIT",
    data: new Uint8Array(bytes).buffer,
    weight: 400 as const,
    style: "normal" as const,
  })),
  readFile(
    join(
      process.cwd(),
      "node_modules/@sun-typeface/suit/fonts/static/otf/SUIT-Heavy.otf",
    ),
  ).then((bytes) => ({
    name: "SUIT",
    data: new Uint8Array(bytes).buffer,
    weight: 900 as const,
    style: "normal" as const,
  })),
]);

const logo = readFile(join(process.cwd(), "src/app/icon.svg")).then(
  (b) => `data:image/svg+xml;base64,${b.toString("base64")}`,
);
async function localPhoto(path: string) {
  const directory = resolve(process.cwd(), "public");
  const file = resolve(directory, path.replace(/^\//, ""));
  if (
    !file.startsWith(directory + sep) ||
    !/\.(?:jpg|jpeg|png|webp)$/i.test(file)
  )
    throw new Error("Invalid share image asset");
  return readFile(file);
}
type Artwork = {
  kind: "file" | "catalog" | "creator";
  path: string;
  focal?: string;
  contain?: boolean;
};
function artwork(map: ThemeMap): Artwork | null {
  if (map.kind === "creator")
    return map.cover_path ? { kind: "creator", path: map.cover_path } : null;
  const image = map.editorial?.image;
  if (!image) return null;
  const upload = image.match(/^\/api\/catalog\/images\/([0-9a-f-]{36})$/i);
  return {
    kind: upload ? "catalog" : "file",
    path: upload ? upload[1] : image,
    focal: map.editorial?.focalPoint,
    contain: map.editorial?.wholeSubject,
  };
}
async function photoBytes(source: Artwork) {
  if (source.kind === "file") return localPhoto(source.path);
  let path = source.path;
  if (source.kind === "catalog") {
    // Always anonymous: drafts and owner-only images are never share artwork.
    const { data, error } = await publicDb().rpc("catalog_image_access", {
      image_id: source.path,
    });
    if (
      error ||
      !data ||
      typeof data !== "object" ||
      !("path" in data) ||
      typeof data.path !== "string"
    )
      throw new Error("Share artwork is not public");
    path = data.path;
  }
  const file = await serviceDb()
    .storage.from(
      source.kind === "catalog" ? "catalog-images" : "creator-map-covers",
    )
    .download(path);
  if (file.error || !file.data) throw new Error("Share artwork unavailable");
  return Buffer.from(await file.data.arrayBuffer());
}
async function preparePhoto(
  bytes: Buffer,
  width: number,
  height: number,
  source?: Artwork,
) {
  const options = { limitInputPixels: 40_000_000 };
  const normalized = await sharp(bytes, options).rotate().toBuffer();
  let image = sharp(normalized, options);
  if (source?.contain)
    image = image.resize(width, height, {
      fit: "contain",
      background: "#151b23",
    });
  else {
    const meta = await sharp(normalized).metadata();
    if (!meta.width || !meta.height) throw new Error("Invalid artwork size");
    const scale = Math.max(width / meta.width, height / meta.height);
    const cropWidth = Math.min(meta.width, Math.round(width / scale)),
      cropHeight = Math.min(meta.height, Math.round(height / scale));
    const [fx = 50, fy = 50] =
      source?.focal?.match(/[\d.]+/g)?.map(Number) ?? [];
    const clamp = (v: number) => Math.max(0, Math.min(1, v / 100));
    image = image
      .extract({
        left: Math.round((meta.width - cropWidth) * clamp(fx)),
        top: Math.round((meta.height - cropHeight) * clamp(fy)),
        width: cropWidth,
        height: cropHeight,
      })
      .resize(width, height);
  }
  return `data:image/jpeg;base64,${(await image.jpeg({ quality: 86 }).toBuffer()).toString("base64")}`;
}
async function mapBackground(photo: string) {
  const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="shade"><stop offset="0" stop-color="#151b23"/><stop offset=".30" stop-color="#151b23"/><stop offset=".43" stop-color="#151b23" stop-opacity=".93"/><stop offset=".66" stop-color="#151b23" stop-opacity=".35"/><stop offset="1" stop-color="#151b23" stop-opacity=".06"/></linearGradient></defs><rect width="1200" height="630" fill="url(#shade)"/></svg>`,
  );
  const bytes = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: "#151b23" },
  })
    .composite([
      { input: Buffer.from(photo.split(",")[1], "base64"), left: 460, top: 0 },
      { input: gradient, left: 0, top: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
async function encode(element: React.ReactElement) {
  const image = new ImageResponse(element, {
    ...SHARE_CARD_SIZE,
    fonts: await fonts,
  });
  const bytes = new Uint8Array(
    await sharp(Buffer.from(await image.arrayBuffer()))
      .flatten({ background: "#151b23" })
      .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
      .toBuffer(),
  );
  return {
    bytes,
    etag: `"${createHash("sha256").update(bytes).digest("hex")}"`,
  };
}
export async function renderMapShareCard(input: {
  title: string;
  label: string;
  artwork: Artwork | null;
}) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("public-community");
  let photo: string | null = null;
  if (input.artwork) {
    try {
      photo = await mapBackground(
        await preparePhoto(
          await photoBytes(input.artwork),
          740,
          630,
          input.artwork,
        ),
      );
    } catch {
      console.warn("share_artwork_unavailable", { kind: input.artwork.kind });
    }
  }
  return encode(
    <MapShareCard
      title={input.title}
      label={input.label}
      photo={photo}
      logo={await logo}
    />,
  );
}
export async function mapShareCard(map: ThemeMap) {
  return renderMapShareCard({
    title: shareCardTitle(map),
    label: shareCardLabel(map),
    artwork: artwork(map),
  });
}
export async function homeShareCard() {
  "use cache";
  cacheLife("days");
  const photos = await Promise.all(
    [
      ["/korea-ramen-restaurant.jpg", 420, 282],
      ["/korea-vintage-shop.jpg", 268, 351],
      ["/seoul-night-view.jpg", 268, 311],
    ].map(async ([path, w, h]) =>
      preparePhoto(await localPhoto(String(path)), Number(w), Number(h)),
    ),
  );
  return encode(<HomeShareCard photos={photos} logo={await logo} />);
}
