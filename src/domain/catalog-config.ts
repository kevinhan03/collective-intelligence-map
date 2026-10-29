/** Editorial metadata for public theme maps. Missing entries remain discoverable. */
export const catalogCategories = [
  { id: "food", label: "음식·카페" },
  { id: "fashion", label: "패션·쇼핑" },
  { id: "travel", label: "여행·산책" },
  { id: "rest", label: "휴식·체험" },
] as const;
export type CatalogCategory = (typeof catalogCategories)[number]["id"];
export type CatalogEditorial = {
  title: string;
  category: CatalogCategory;
  aliases: string[];
  image: string;
  focalPoint?: string;
  order: number;
  featured?: boolean;
  reason?: string;
  wholeSubject?: boolean;
  region?: string;
};
export const catalogEditorial: Record<string, CatalogEditorial> = {
  "korea-vintage": {
    title: "전국 빈티지숍",
    category: "fashion",
    aliases: ["빈티지샵", "vintage", "세컨핸드"],
    image: "/korea-vintage-shop.jpg",
    focalPoint: "50% 52%",
    order: 0,
    featured: true,
    reason: "오래된 옷 속에서 나만의 취향을 발견해요",
  },
  "tokyo-fashion": {
    title: "도쿄 패션 스토어",
    category: "fashion",
    aliases: ["tokyo", "東京", "일본 쇼핑"],
    image: "/tokyo-fashion-store-interior.jpg",
    order: 1,
  },
  "korea-fashion-store": {
    title: "국내 브랜드·편집숍",
    category: "fashion",
    aliases: ["디자이너", "쇼룸", "플래그십", "국내 브랜드"],
    image: "/korea-fashion-store.jpg",
    focalPoint: "50% 65%",
    order: 2,
  },
  "seoul-taco-restaurant": {
    region: "서울",
    title: "서울 타코 맛집",
    category: "food",
    aliases: ["taco", "멕시칸"],
    image: "/seoul-taco-restaurant.jpg",
    order: 3,
  },
  "korea-best-burger": {
    title: "전국 수제버거",
    category: "food",
    aliases: ["햄버거", "burger"],
    image: "/korea-best-burger-whole.jpeg",
    focalPoint: "50% 70%",
    wholeSubject: true,
    order: 4,
  },
  "choiza-road-restaurants": {
    title: "최자로드 맛집",
    category: "food",
    aliases: ["최자", "최자로드"],
    image: "/choiza-road-restaurants.jpeg",
    order: 5,
  },
  "seoul-night-view": {
    title: "서울 야경 명소",
    category: "travel",
    aliases: ["야경", "전망", "night view", "서울"],
    image: "/seoul-night-view.jpg",
    order: 6,
  },
  "korea-sauna-map": {
    title: "전국 사우나·숯가마",
    category: "rest",
    aliases: ["sauna", "찜질방", "목욕", "숯가마"],
    image: "/korea-sauna-map.webp",
    order: 7,
  },
  "korea-ramen-restaurant": {
    title: "전국 라멘 맛집",
    category: "food",
    aliases: ["ramen", "일식"],
    image: "/korea-ramen-restaurant.jpg",
    order: 8,
  },
};
