const labels: Record<string, string> = {
  barber: "바버숍",
  bar: "바",
  boutique: "부티크",
  cafe: "카페",
  clothing_store: "의류 매장",
  department_store: "백화점",
  furniture_store: "가구점",
  photography_store_and_services: "사진관",
  shoe_store: "신발 매장",
  thrift_store: "중고·빈티지 숍",
};

export function placeCategoryLabel(category?: string) {
  if (!category) return "장소";
  return labels[category] ?? "장소";
}
