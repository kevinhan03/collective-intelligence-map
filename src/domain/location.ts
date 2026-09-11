const countryNames: Record<string, string> = { JP: "Japan", KR: "Korea" };
export function formatLocation(map: { city: string; country: string }) {
  const country = countryNames[map.country] ?? map.country;
  return map.city.toLowerCase() === country.toLowerCase()
    ? country.toUpperCase()
    : `${map.city}, ${country}`.toUpperCase();
}
