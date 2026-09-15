/** The only module coupled to Overture's upstream schema. No community fields. */
export function normalizePlace(row, region, release) {
  if (row.operating_status === "closed") return null;
  const name = row.names?.primary?.trim();
  const lon = Number(row.longitude),
    lat = Number(row.latitude);
  const b = region.bounds;
  if (!name || !row.id || !Number.isFinite(lon) || !Number.isFinite(lat))
    throw new Error("Invalid Overture point/name");
  if (lon < b.west || lon > b.east || lat < b.south || lat > b.north)
    return null;
  const address =
    row.addresses?.find((a) => a.country === region.country) ??
    row.addresses?.[0];
  if (address?.country && address.country !== region.country) return null;
  const alternates = [
    ...new Set(
      [
        ...Object.values(row.names?.common ?? {}),
        ...(row.names?.rules ?? []).map((r) => r.value),
      ].filter((v) => typeof v === "string" && v !== name),
    ),
  ];
  return {
    source: "overture",
    source_id: row.id,
    primary_name: name.slice(0, 120),
    alternate_names: alternates,
    country_code: region.country,
    region: address?.region ?? null,
    locality: address?.locality ?? region.city,
    address: (address?.freeform ?? "").slice(0, 250),
    latitude: lat,
    longitude: lon,
    category: (row.categories?.primary ?? "other").slice(0, 40),
    search_text: [name, ...alternates].join(" "),
    release,
  };
}
