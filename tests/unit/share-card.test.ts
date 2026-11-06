import { expect, it } from "vitest";
import { demoMap } from "@/server/demo";
import { catalogEditorial } from "@/domain/catalog-config";
import {
  mapShareImage,
  mapShareTitle,
  shareCardTitle,
} from "@/domain/share-card";
const map = {
  ...demoMap,
  editorial: catalogEditorial["korea-ramen-restaurant"],
};
it("uses editorial titles on community shares and preserves creator titles", () => {
  expect(shareCardTitle(map)).toBe("전국 라멘 맛집");
  expect(mapShareTitle(map)).toBe("전국 라멘 맛집 | 팅맵");
  expect(shareCardTitle({ ...map, kind: "creator", title: "나의 지도" })).toBe(
    "나의 지도",
  );
});
it("versions artwork and title changes while ignoring engagement statistics", () => {
  const path = mapShareImage(map);
  expect(path).toContain("/image.jpg?v=1-");
  expect(mapShareImage({ ...map, place_count: 900, hype_count: 1234 })).toBe(
    path,
  );
  expect(
    mapShareImage({
      ...map,
      editorial: { ...map.editorial, title: "다른 제목" },
    }),
  ).not.toBe(path);
  expect(
    mapShareImage({
      ...map,
      editorial: { ...map.editorial, focalPoint: "80% 50%" },
    }),
  ).not.toBe(path);
  expect(
    mapShareImage({
      ...map,
      editorial: { ...map.editorial, image: "/other.jpg" },
    }),
  ).not.toBe(path);
});
it("does not expose Storage paths in share URLs", () => {
  const path = mapShareImage({
    ...map,
    kind: "creator",
    cover_path: "private/user/secret-path.webp",
  });
  expect(path).not.toContain("secret");
  expect(path).not.toContain("user");
});
