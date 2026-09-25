const cities: [RegExp, string][] = [
  [/서울|Seoul/i, "서울"],
  [/부산|Busan/i, "부산"],
  [/인천|Incheon/i, "인천"],
  [/대구|Daegu/i, "대구"],
  [/대전|Daejeon/i, "대전"],
  [/광주|Gwangju/i, "광주"],
  [/울산|Ulsan/i, "울산"],
  [/수원|Suwon/i, "수원"],
  [/용인|Yongin/i, "용인"],
  [/도쿄|Tokyo|東京都/i, "도쿄"],
  [/오사카|Osaka|大阪/i, "오사카"],
];

export function placeArea(address: string) {
  const city = cities.find(([pattern]) => pattern.test(address))?.[1];
  if (!city) return "";
  const district = address.match(/[가-힣]{2,8}(?:구|군|동)/)?.[0];
  return district && district !== city ? `${city} · ${district}` : city;
}
