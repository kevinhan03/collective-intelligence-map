const countryNames: Record<string, string> = { JP: "일본", KR: "한국" };
const cityNames: Record<string, string> = {
  korea: "한국",
  japan: "일본",
  tokyo: "도쿄",
  seoul: "서울",
};

export function regionName(map: { city: string }) {
  return cityNames[map.city.toLowerCase()] ?? map.city;
}

export function formatLocation(map: { city: string; country: string }) {
  const country = countryNames[map.country] ?? map.country;
  const city = regionName(map);
  return city === country ? country : `${city} · ${country}`;
}
