import { expect, it } from "vitest";
import { normalizeStations } from "../../scripts/stations/normalize.mjs";

it("excludes buses, tram stops and non-operating stations and merges nearby duplicates", () => {
  const station = (id: number, tags: Record<string, string>, lat = 35.66) => ({
    type: "node",
    id,
    lat,
    lon: 139.7,
    tags: { name: "渋谷駅", railway: "station", ...tags },
  });
  const result = normalizeStations(
    [
      station(1, { station: "subway" }),
      station(2, {}, 35.662),
      station(3, { railway: "tram_stop" }),
      station(4, { highway: "bus_stop", railway: "" }),
      station(5, { station: "tram" }),
      station(6, { disused: "yes" }),
      station(7, { "construction:railway": "station" }),
      station(8, { name: "遠い駅" }, 35.68),
      station(9, {}, 34),
    ],
    "tokyo",
  );
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({
    id: "osm:node:1",
    kind: "subway",
    local_name: "渋谷駅",
  });
});
