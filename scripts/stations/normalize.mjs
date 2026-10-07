export const regions = {
  seoul: { bounds: [37.35, 126.75, 37.75, 127.25], language: "ko" },
  tokyo: { bounds: [35.45, 139.45, 35.9, 139.95], language: "ja" },
};

function distance(a, b) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742000 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function normalizeStations(elements, region) {
  const {
    bounds: [south, west, north, east],
    language,
  } = regions[region];
  const items = elements
    .flatMap((element) => {
      const tags = element.tags ?? {};
      if (
        !["station", "halt"].includes(tags.railway) ||
        ["tram", "light_rail", "monorail"].includes(tags.station)
      )
        return [];
      if (
        ["disused", "abandoned", "construction", "proposed"].some(
          (key) => tags[key] === "yes" || tags[`${key}:railway`],
        )
      )
        return [];
      if (tags.tram === "yes" && tags.train !== "yes" && tags.subway !== "yes")
        return [];
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      const localName =
        tags[`name:${language}`] ?? tags.name ?? tags["name:en"];
      if (
        !localName ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < south ||
        lat > north ||
        lng < west ||
        lng > east
      )
        return [];
      return [
        {
          id: `osm:${element.type}:${element.id}`,
          name: tags["name:ko"] ?? localName,
          local_name: localName,
          kind:
            tags.station === "subway" || tags.subway === "yes"
              ? "subway"
              : "train",
          lat,
          lng,
        },
      ];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const result = [];
  for (const station of items) {
    const name = station.local_name
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/(?:駅|역| station)$/u, "");
    const duplicate = result.find(
      (other) =>
        other.local_name
          .normalize("NFKC")
          .trim()
          .toLowerCase()
          .replace(/(?:駅|역| station)$/u, "") === name &&
        distance(station, other) <= 350,
    );
    if (duplicate) {
      if (station.kind === "subway") duplicate.kind = "subway";
    } else result.push(station);
  }
  return result;
}
