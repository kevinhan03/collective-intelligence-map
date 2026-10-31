// Standalone design data. No production APIs or user-account writes.
const categories = [
  {
    id: "food",
    label: "음식·카페",
    icon: "utensils",
  },
  {
    id: "fashion",
    label: "패션·쇼핑",
    icon: "shopping-bag",
  },
  {
    id: "travel",
    label: "여행·산책",
    icon: "mountain",
  },
  {
    id: "rest",
    label: "휴식·체험",
    icon: "leaf",
  },
];
const maps = [
  {
    id: "korea-vintage",
    title: "전국 빈티지숍",
    category: "fashion",
    region: "전국",
    regions: ["한국", "서울", "경기", "부산"],
    count: 47,
    image: "/korea-vintage-shop.jpg",
    focus: "50% 52%",
    hype: 0,
    alias: "vintage 세컨핸드 빈티지샵",
    featured: true,
  },
  {
    id: "tokyo-fashion",
    title: "도쿄 패션 스토어",
    category: "fashion",
    region: "도쿄",
    regions: ["일본", "도쿄"],
    count: 7,
    image: "/tokyo-fashion-store-interior.jpg",
    hype: 0,
    alias: "tokyo 東京 일본 쇼핑",
  },
  {
    id: "korea-fashion-store",
    title: "국내 브랜드·편집숍",
    category: "fashion",
    region: "전국",
    regions: ["한국", "서울", "경기"],
    count: 72,
    image: "/korea-fashion-store.jpg",
    focus: "50% 65%",
    hype: 0,
    alias: "디자이너 쇼룸 플래그십",
    featured: true,
  },
  {
    id: "seoul-taco-restaurant",
    title: "서울 타코 맛집",
    category: "food",
    region: "서울",
    regions: ["한국", "서울"],
    count: 24,
    image: "/seoul-taco-restaurant.jpg",
    hype: 1,
    alias: "taco 멕시칸",
    featured: true,
  },
  {
    id: "korea-best-burger",
    title: "전국 수제버거",
    category: "food",
    region: "전국",
    regions: ["한국", "서울", "경기", "부산"],
    count: 16,
    image: "/korea-best-burger-whole.jpeg",
    focus: "50% 68%",
    hype: 1,
    alias: "burger 햄버거",
  },
  {
    id: "choiza-road-restaurants",
    title: "최자로드 맛집",
    category: "food",
    region: "전국",
    regions: ["한국", "서울", "부산"],
    count: 19,
    image: "/choiza-road-restaurants.jpeg",
    hype: 0,
    alias: "최자 최자로드",
  },
  {
    id: "seoul-night-view",
    title: "서울 야경 명소",
    category: "travel",
    region: "서울",
    regions: ["한국", "서울"],
    count: 10,
    image: "/seoul-night-view.jpg",
    hype: 0,
    alias: "night view seoul 전망 일몰",
    featured: true,
  },
  {
    id: "korea-sauna-map",
    title: "전국 사우나·숯가마",
    category: "rest",
    region: "전국",
    regions: ["한국", "경기"],
    count: 3,
    image: "/korea-sauna-map.webp",
    hype: 0,
    alias: "sauna 찜질방 목욕 숯가마",
  },
  {
    id: "korea-ramen-restaurant",
    title: "전국 라멘 맛집",
    category: "food",
    region: "전국",
    regions: ["한국", "서울", "부산"],
    count: 27,
    image: "/korea-ramen-restaurant.jpg",
    hype: 0,
    alias: "ramen 일식",
  },
];
const main = document.querySelector("main");
let saved = new Set(),
  hyped = new Set();
try {
  saved = new Set(
    JSON.parse(localStorage.getItem("ting-desktop-prototype-saved") || "[]"),
  );
  hyped = new Set(
    JSON.parse(localStorage.getItem("ting-desktop-prototype-hyped") || "[]"),
  );
} catch {}
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) =>
  `<img src="icons/${name}.svg" alt="" aria-hidden="true">`;
const category = (id) => categories.find((item) => item.id === id);
function state() {
  const [page, query = ""] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(query);
  return {
    page: ["home", "explore", "saved"].includes(page) ? page : "home",
    q: params.get("q") || "",
    category: categories.some((c) => c.id === params.get("category"))
      ? params.get("category")
      : "",
    region: ["한국", "일본", "서울", "경기", "부산", "도쿄"].includes(
      params.get("region"),
    )
      ? params.get("region")
      : "",
    sort: ["default", "popular", "places"].includes(params.get("sort"))
      ? params.get("sort")
      : "default",
  };
}
function href(patch = {}) {
  const next = { ...state(), ...patch };
  const params = new URLSearchParams();
  for (const key of ["q", "category", "region", "sort"])
    if (next[key] && !(key === "sort" && next[key] === "default"))
      params.set(key, next[key]);
  return `#${next.page}${params.size ? "?" + params : ""}`;
}
function matches(map, s, omit = "") {
  const text = [
    map.title,
    map.region,
    ...map.regions,
    map.alias,
    category(map.category).label,
  ]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  return (
    (omit === "category" || !s.category || s.category === map.category) &&
    (omit === "region" || !s.region || map.regions.includes(s.region)) &&
    s.q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .every((token) => text.includes(token))
  );
}
function card(map, s = state()) {
  const included = s.region && s.region !== map.region;
  return `<article class="card overlay-card">
    <a class="card-link" href="http://localhost:3000/maps/${map.id}" target="_blank" rel="noopener" aria-label="${map.title} 기존 지도 열기">
      <div class="card-photo" style="--focus:${map.focus || "50% 50%"}"><img src="${map.image}" alt="" loading="lazy"></div>
      <div class="card-info"><h3>${map.title}</h3><p class="meta">${map.region}${included ? " · " + esc(s.region) + " 포함" : ""}</p>
        <div class="card-bottom"><span class="tag">${category(map.category).label}</span><span class="places">${included ? "전체 " : ""}${map.count}<small>곳</small></span></div>
      </div>
    </a>
    <button class="save" data-save="${map.id}" aria-label="${map.title} ${saved.has(map.id) ? "저장 취소" : "저장"}" aria-pressed="${saved.has(map.id)}"><span>${icon("bookmark")}</span></button>
    <button class="hype" data-hype="${map.id}" aria-label="${map.title} Hype ${hyped.has(map.id) ? "취소" : "추천"}" aria-pressed="${hyped.has(map.id)}"><span>${icon("flame")}<span>${map.hype + Number(hyped.has(map.id))}</span></span></button>
  </article>`;
}
function homeIntro() {
  return `<section class="home-intro" aria-label="취향으로 지도 찾기">
    <h1>같은 <em>취향</em>이 모이는 지도</h1>
    <p>취향 있는 사람들의 추천으로, 다음 장소를 발견하세요.</p>
    <form class="home-search" role="search" aria-label="테마 지도 검색">
      ${icon("search")}
      <input type="search" name="q" aria-label="테마 지도 검색어" placeholder="지역이나 관심 있는 테마 검색" autocomplete="off">
      <button type="submit" aria-label="검색하기">${icon("arrow-right")}</button>
    </form>
  </section>`;
}
function categoryTile(c) {
  return `<a class="category-card" data-category="${c.id}" href="#explore?category=${c.id}">
    <h3>${c.label}</h3>
    <p>지도 ${maps.filter((m) => m.category === c.id).length}개</p>
    <img class="arrow" src="icons/arrow-right.svg" alt="">
  </a>`;
}
function home() {
  const featured = maps.filter((m) => m.featured);
  return `${homeIntro()}<section class="section"><div class="section-head"><div><h2>지금 둘러볼 지도</h2><p>서로 다른 취향을 담은 네 개의 지도</p></div><a class="text-link" href="#explore">전체 보기 ${icon("arrow-right")}</a></div><div class="grid">${featured.map((m) => card(m, { region: "" })).join("")}</div></section><section class="section"><div class="section-head"><h2>카테고리별 둘러보기</h2></div><div class="category-grid">${categories.map(categoryTile).join("")}</div></section><section class="section"><div class="section-head"><div><h2>더 많은 테마</h2><p>다음에 가볼 곳을 미리 골라두세요.</p></div><a class="text-link" href="#explore">지도 모두 보기 ${icon("arrow-right")}</a></div><div class="grid">${maps
    .filter((m) => !m.featured)
    .slice(0, 4)
    .map((m) => card(m, { region: "" }))
    .join("")}</div></section>`;
}
function sidebar(s) {
  const options = (items, key) =>
    items
      .map((item) => {
        const value = typeof item === "string" ? item : item.id;
        const label = typeof item === "string" ? item : item.label;
        const count = maps.filter((m) =>
          matches(m, { ...s, [key]: value }, ""),
        ).length;
        return `<a class="filter-option ${s[key] === value ? "active" : ""}" href="${href({ [key]: value })}" ${s[key] === value ? 'aria-current="true"' : ""}>${icon(key === "category" ? category(value)?.icon || "grid-2x2" : "map-pin")}<span>${label}</span><span class="count">${count}</span></a>`;
      })
      .join("");
  return `<aside class="sidebar" aria-label="탐색 조건"><section class="sidebar-group"><h2>카테고리</h2>${options([{ id: "", label: "전체" }, ...categories], "category")}</section><section class="sidebar-group"><h2>지역</h2>${options([{ id: "", label: "전체" }, "서울", "경기", "부산", "도쿄"], "region")}</section><p class="sidebar-note">선택한 지역의 장소를 포함한<br>전국 지도도 함께 보여드려요.</p></aside>`;
}
function explore(s) {
  let results = maps.filter((m) => matches(m, s));
  if (s.sort === "popular")
    results.sort(
      (a, b) =>
        b.hype + Number(hyped.has(b.id)) - a.hype - Number(hyped.has(a.id)),
    );
  else if (s.sort === "places") results.sort((a, b) => b.count - a.count);
  const name = category(s.category)?.label || "전체";
  const conditions = [
    s.q
      ? `<a href="${href({ q: "" })}" aria-label="검색어 조건 해제">${esc(s.q)} ${icon("x")}</a>`
      : "",
    s.category
      ? `<a href="${href({ category: "" })}" aria-label="카테고리 조건 해제">${name} ${icon("x")}</a>`
      : "",
    s.region
      ? `<a href="${href({ region: "" })}" aria-label="지역 조건 해제">${esc(s.region)} ${icon("x")}</a>`
      : "",
  ].filter(Boolean);
  return `<div class="explore">${sidebar(s)}<section class="results" aria-label="테마 지도 검색 결과"><div class="results-head"><div><h1>${name} 테마 지도 <span>${results.length}개</span></h1><p>${s.q ? "“" + esc(s.q) + "” 검색 결과" : s.region ? esc(s.region) + "의 장소가 포함된 지도를 모았어요." : "취향에 맞는 지도를 골라보세요."}</p></div><nav class="sort" aria-label="지도 정렬">${[
    { id: "default", label: "기본순" },
    { id: "popular", label: "Hype순" },
    { id: "places", label: "장소 많은 순" },
  ]
    .map(
      (item) =>
        `<a href="${href({ sort: item.id })}" class="${s.sort === item.id ? "active" : ""}" ${s.sort === item.id ? 'aria-current="true"' : ""}>${item.label}</a>`,
    )
    .join(
      "",
    )}</nav></div>${conditions.length ? `<div class="selected" aria-label="선택한 조건">${conditions.join("")}${conditions.length > 1 ? '<a href="#explore">모두 해제</a>' : ""}</div>` : ""}<div class="grid">${results.length ? results.map((m) => card(m, s)).join("") : `<div class="empty"><h2>조건에 맞는 지도가 없어요.</h2><p>다른 지역이나 카테고리로 범위를 넓혀보세요.</p><a class="chip" href="#explore">전체 지도 보기</a></div>`}</div></section></div>`;
}
function savedPage() {
  const items = maps.filter((m) => saved.has(m.id));
  return `<section class="saved-page"><div class="section-head"><div><h1>저장한 지도 <span>${items.length}</span></h1><p>다음에 둘러볼 지도를 한곳에</p></div><a class="text-link" href="#explore">다른 지도 찾기 ${icon("arrow-right")}</a></div><div class="grid">${items.length ? items.map((m) => card(m, { region: "" })).join("") : '<div class="empty"><h2>마음에 드는 지도를 저장해 보세요.</h2><p>사진 위의 북마크를 누르면 이곳에 모여요.</p><a class="chip" href="#explore">지도 둘러보기</a></div>'}</div></section>`;
}
function render() {
  const s = state();
  document.body.dataset.page = s.page;
  main.innerHTML =
    s.page === "home" ? home() : s.page === "saved" ? savedPage() : explore(s);
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === s.page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.querySelector(".global-search input").value =
    s.page === "explore" ? s.q : "";
  document.querySelector("#saved-count").textContent = saved.size || "";
  document.title = `${s.page === "home" ? "홈" : s.page === "saved" ? "저장" : "탐색"} · Ting Map 디자인 시안`;
}
let toastTimer;
function toast(message) {
  const el = document.querySelector(".toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}
document.addEventListener("submit", (event) => {
  if (!event.target.matches(".global-search, .home-search")) return;
  event.preventDefault();
  const q = new FormData(event.target).get("q").trim();
  location.hash = href({ page: "explore", q });
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save],[data-hype]");
  if (!button) return;
  const isSave = Boolean(button.dataset.save);
  const id = button.dataset.save || button.dataset.hype;
  const set = isSave ? saved : hyped;
  const active = !set.has(id);
  active ? set.add(id) : set.delete(id);
  try {
    localStorage.setItem(
      "ting-desktop-prototype-" + (isSave ? "saved" : "hyped"),
      JSON.stringify([...set]),
    );
  } catch {}
  if (
    state().page === "saved" ||
    (!isSave && state().page === "explore" && state().sort === "popular")
  )
    render();
  else {
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      maps.find((m) => m.id === id).title +
        " " +
        (isSave
          ? active
            ? "저장 취소"
            : "저장"
          : active
            ? "Hype 취소"
            : "Hype 추천"),
    );
    if (!isSave)
      button.querySelector("span span").textContent =
        maps.find((m) => m.id === id).hype + Number(active);
    document.querySelector("#saved-count").textContent = saved.size || "";
  }
  toast(
    isSave
      ? active
        ? "지도에 취향을 담아뒀어요."
        : "저장을 취소했어요."
      : active
        ? "이 지도에 Hype를 보냈어요."
        : "Hype를 취소했어요.",
  );
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
});
render();
