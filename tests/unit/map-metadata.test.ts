import { expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { demoMap } from "@/server/demo";
import { mapSearchTitle } from "@/domain/seo";
import { ogImage } from "@/lib/seo";

vi.mock("@/server/queries", () => ({ getMap: vi.fn() }));
vi.mock("@/server/seo-queries", () => ({}));
vi.mock("@/components/community/community-explorer", () => ({}));
vi.mock("@/components/community/proposal-notice", () => ({}));
vi.mock("@/components/community/viewer-state", () => ({}));
import { getMap } from "@/server/queries";
import { generateMetadata } from "@/app/maps/[slug]/page";

it("missing maps override an indexable parent's robots directive", async () => {
  vi.mocked(getMap).mockResolvedValue(null);
  const child = await generateMetadata({
    params: Promise.resolve({ slug: "missing-map" }),
  });
  // Next's CJS metadata resolver requires the server condition for server-only.
  // Resolve real metadata in a separate server process; production data is mocked above.
  const items = [
    [
      {
        title: { default: "팅맵", template: "%s · 팅맵 (Ting map)" },
        robots: { index: true, follow: true },
      },
      null,
    ],
    [null, null], // The leaf layout and page occupy separate metadata items.
    [child, null],
  ];
  const metadata = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "-e",
        `
    const { accumulateMetadata } = require("next/dist/lib/metadata/resolve-metadata");
    accumulateMetadata("/maps/missing-map", JSON.parse(process.argv[1]),
      Promise.resolve("/maps/missing-map"),
      { trailingSlash: false, isStaticMetadataRouteFile: false }
    ).then(metadata => process.stdout.write(JSON.stringify(metadata)));
  `,
        JSON.stringify(items),
      ],
      { encoding: "utf8" },
    ),
  );
  expect(metadata.title?.absolute).toBe(
    "지도를 찾을 수 없어요 · 팅맵 (Ting map)",
  );
  expect(metadata.robots?.basic).toBe("noindex, follow");
});

it.each([false, true])(
  "preserves public map metadata with creator cover %s",
  async (creator) => {
    const map = creator
      ? { ...demoMap, kind: "creator" as const, cover_path: "cover.jpg" }
      : demoMap;
    vi.mocked(getMap).mockResolvedValue(map);
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: map.slug }),
    });
    const title = mapSearchTitle(map);
    const images = creator ? [`/maps/${map.slug}/cover`] : [ogImage];
    expect(metadata).toEqual({
      title,
      description: map.description,
      alternates: { canonical: `/maps/${map.slug}` },
      openGraph: {
        title,
        description: map.description,
        url: `/maps/${map.slug}`,
        images,
      },
      twitter: { title, description: map.description, images },
    });
  },
);
