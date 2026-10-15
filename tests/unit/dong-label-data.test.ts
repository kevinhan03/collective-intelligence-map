import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
// Generator is deliberately Node-only, never bundled into the client.
import { normalizeDongLabels } from "../../scripts/map-labels/normalize.mjs";

it("uses the largest polygon and places its label inside, outside holes", () => {
  const small = [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ];
  const large = [
    [
      [10, 10],
      [20, 10],
      [20, 20],
      [10, 20],
      [10, 10],
    ],
    [
      [14, 14],
      [16, 14],
      [16, 16],
      [14, 16],
      [14, 14],
    ],
  ];
  const features = ["테스트동", "테스트읍", "테스트면", "테스트구"].map(
    (name, index) => ({
      properties: {
        adm_nm: `서울특별시 테스트구 ${name}`,
        adm_cd2: String(1111111110 + index),
      },
      geometry: { type: "MultiPolygon", coordinates: [small, large] },
    }),
  );
  const result = normalizeDongLabels({ features });
  expect(result.features).toHaveLength(1);
  const [x, y] = result.features[0].geometry.coordinates;
  expect(x).toBeGreaterThan(10);
  expect(x).toBeLessThan(20);
  expect(y).toBeGreaterThan(10);
  expect(y).toBeLessThan(20);
  expect(x < 14 || x > 16 || y < 14 || y > 16).toBe(true);
});

it("ships only nationwide dong names, unique codes and Korean point coordinates", () => {
  const data = JSON.parse(
    readFileSync("public/map-data/korea-dong-labels.20260701.geojson", "utf8"),
  );
  expect(data.features).toHaveLength(2155);
  const codes = new Set();
  for (const feature of data.features) {
    expect(Object.keys(feature.properties).sort()).toEqual(["code", "name"]);
    expect(feature.properties.name).toMatch(/^\S+동$/);
    expect(feature.geometry.type).toBe("Point");
    const [lng, lat] = feature.geometry.coordinates;
    expect(lng).toBeGreaterThan(124);
    expect(lng).toBeLessThan(132);
    expect(lat).toBeGreaterThan(33);
    expect(lat).toBeLessThan(39);
    expect(codes.has(feature.properties.code)).toBe(false);
    codes.add(feature.properties.code);
  }
  for (const name of ["한남동", "이태원2동", "후암동"]) {
    const feature = data.features.find(
      (item: { properties: { name: string } }) => item.properties.name === name,
    );
    expect(feature).toBeDefined();
    expect(feature.geometry.coordinates[0]).toBeGreaterThan(126.95);
    expect(feature.geometry.coordinates[0]).toBeLessThan(127.03);
    expect(feature.geometry.coordinates[1]).toBeGreaterThan(37.52);
    expect(feature.geometry.coordinates[1]).toBeLessThan(37.56);
  }
});
