import "server-only";
import { getMap } from "./queries";
import {
  getPublicPlace,
  getPublicPlaceDirectory,
  getPublicInventory,
  type PublicInventoryPlace,
} from "./seo-queries";
import { areaPath, areaTitle, seoAreas } from "@/domain/seo-areas";
import type { ThemeMap } from "@/domain/types";
import { jsonLd, mapSearchTitle, placePath } from "@/domain/seo";
import { placeArea } from "@/domain/place-location";
import { directionsUrl } from "@/domain/visit";
import { canIndex, ogImage, siteOrigin, siteVerification } from "@/lib/seo";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const absolute = (path: string) =>
  `${siteOrigin ?? "http://localhost:3000"}${path}`;
const link = (path: string, label: string, className = "") =>
  `<a href="${escape(path)}" class="${escape(className)}">${escape(label)}</a>`;

function regionLinks(
  map: ThemeMap,
  inventory: PublicInventoryPlace[],
  placeId?: string,
) {
  const areas = seoAreas(inventory).filter(
    (area) => !placeId || area.placeIds.includes(placeId),
  );
  return areas.length
    ? `<section><h2>지역별로 찾아보기</h2><nav class="actions" aria-label="지역별 장소 목록">${areas.map((area) => link(areaPath(map.slug, area.key), `${area.label} · ${area.placeIds.length}곳`, "button")).join("")}</nav></section>`
    : "";
}

// These informational routes deliberately return complete HTML rather than a
// PPR shell. AI fetchers do not need React's streaming scripts to read the body.
function document(
  title: string,
  description: string,
  path: string,
  body: string,
  structured: unknown,
) {
  const url = absolute(path),
    image = absolute(ogImage);
  const verification = [
    ["google-site-verification", siteVerification.google],
    ["msvalidate.01", siteVerification.bing],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => `<meta name="${name}" content="${escape(value!)}">`)
    .join("");
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Ting map</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${canIndex ? "index, follow" : "noindex, follow"}"><link rel="canonical" href="${escape(url)}"><link rel="icon" href="/icon.svg"><meta property="og:type" content="website"><meta property="og:site_name" content="Ting map"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}"><style>
  *{box-sizing:border-box}body{margin:0;background:#10151b;color:#f4f5f2;font-family:system-ui,-apple-system,sans-serif;line-height:1.7}a{color:#dbff5e;text-underline-offset:4px}header.site,main,footer{width:calc(100% - 40px);max-width:1200px;margin:auto}.site{display:flex;justify-content:space-between;align-items:center;padding:24px 0;border-bottom:1px solid #ffffff26}.brand{font-size:24px;font-weight:800;text-decoration:none;color:#f4f5f2}main{padding:36px 0 64px}h1{font-size:clamp(28px,4vw,40px);line-height:1.25}h2{font-size:20px;line-height:1.5}.muted{color:#b5bbc4}.copy{max-width:800px}.cards{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.card{border:1px solid #ffffff26;border-radius:20px;padding:24px;background:#1a2028}.reason{white-space:pre-wrap}.actions,nav.pages{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}.button{border:1px solid #ffffff35;border-radius:12px;padding:10px 16px;text-decoration:none}.primary{background:#dbff5e;color:#10151b}footer{border-top:1px solid #ffffff26;padding:16px 0 24px;text-align:right;font-size:12px}footer a{color:#b5bbc4;margin-left:12px}@media(max-width:640px){.cards{grid-template-columns:1fr}.card{padding:20px}.site{padding:16px 0}main{padding-top:24px}} </style><script type="application/ld+json">${jsonLd(structured)}</script>${verification}</head><body><header class="site">${link("/", "Ting map", "brand")}${link("/discover", "지도 발견")}</header><main id="main">${body}</main><footer>${link("/terms", "이용약관")}${link("/privacy", "개인정보 처리방침")}</footer></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
export function missingPage() {
  return new Response(
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><title>장소를 찾을 수 없습니다 · Ting map</title></head><body><h1>공개 장소를 찾을 수 없습니다.</h1><a href="/discover">지도 발견으로 돌아가기</a></body></html>',
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
export function unavailablePage() {
  return new Response(
    "장소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "60",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}

export async function placeDocument(slug: string, id: string) {
  const map = await getMap(slug);
  const place = map ? await getPublicPlace(map.id, id) : null;
  if (!map || !place) return missingPage();
  const path = placePath(map.slug, place.place_id),
    url = absolute(path);
  const directory = `/maps/${map.slug}/places`;
  const title = `${place.name} · ${placeArea(place.address) || map.city || map.country} · ${map.title}`;
  const description = `${place.address}. ${place.rationale}`.slice(0, 160);
  const regions = regionLinks(
    map,
    await getPublicInventory([map.id]),
    place.place_id,
  );
  const body = `<nav aria-label="현재 위치">${link("/discover", "지도 발견")} / ${link(directory, map.title)}</nav><article class="copy"><h1>${escape(place.name)}</h1><p class="muted">${escape(placeArea(place.address))}</p><p>${escape(place.address)}</p><section class="card"><h2>${escape(map.title)}에 추천하는 이유</h2><p class="reason">${escape(place.rationale)}</p><p class="muted">기여자: ${escape(place.handle)} · 제안일: ${escape(place.created_at.slice(0, 10))}</p>${place.status === "disputed" ? "<p>이 주제에 적합한지 커뮤니티에서 재검토 중입니다.</p>" : ""}</section><section><h2>방문과 최신 정보 확인</h2><p class="muted">추천은 이 지도 주제에 대한 의견입니다. 운영 정보와 방문자 사진은 지도 상세에서 확인하고, 방문 전 최신 정보를 확인해 주세요.</p><div class="actions">${link(`/maps/${map.slug}?place=${encodeURIComponent(place.place_id)}`, "지도에서 상세·사진 보기", "button primary")}${link(directionsUrl(place), "길찾기", "button")}</div></section>${link(directory, `${map.title}의 다른 장소 보기`)}</article>`;
  return document(title, description, path, body + regions, {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        "@id": `${url}#place`,
        name: place.name,
        url,
        address: place.address,
        description: place.rationale,
        geo: {
          "@type": "GeoCoordinates",
          latitude: place.lat,
          longitude: place.lng,
        },
      },
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: title,
        inLanguage: "ko",
        mainEntity: { "@id": `${url}#place` },
        isPartOf: {
          "@type": "CollectionPage",
          name: map.title,
          url: absolute(directory),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Ting map",
            item: absolute("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: map.title,
            item: absolute(directory),
          },
          { "@type": "ListItem", position: 3, name: place.name, item: url },
        ],
      },
    ],
  });
}

export async function directoryDocument(slug: string, page = 1) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return missingPage();
  const map = await getMap(slug);
  if (!map) return missingPage();
  const [{ places, total }, inventory] = await Promise.all([
    getPublicPlaceDirectory(map.id, page),
    getPublicInventory([map.id]),
  ]);
  if (page > 1 && !places.length) return missingPage();
  const base = `/maps/${map.slug}/places`,
    path = page === 1 ? base : `${base}/page/${page}`;
  const title = `${mapSearchTitle(map)} 장소 목록${page > 1 ? ` · ${page}페이지` : ""}`;
  const body = `${link(`/maps/${map.slug}`, "← 지도에서 탐색")}<h1>${escape(title)}</h1><p class="copy muted">${escape(map.description)}</p><p>공개 장소 ${total}곳 · ${page}페이지</p>${!places.length ? `<p>첫 장소 모집 중입니다. ${link(`/maps/${map.slug}/submit`, "첫 장소 제안하기")}</p>` : ""}<ul class="cards">${places.map((p) => `<li class="card"><h2>${link(placePath(map.slug, p.place_id), p.name)}</h2><p class="muted">${escape(p.address)}</p><p>${escape(p.rationale)}</p></li>`).join("")}</ul><nav class="pages" aria-label="장소 목록 페이지">${page > 1 ? link(page === 2 ? base : `${base}/page/${page - 1}`, "이전 페이지") : ""}${page * 40 < total ? link(`${base}/page/${page + 1}`, "다음 페이지") : ""}</nav>`;
  return document(
    title,
    map.description,
    path,
    body + regionLinks(map, inventory),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description: map.description,
      url: absolute(path),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: places.map((p, i) => ({
          "@type": "ListItem",
          position: (page - 1) * 40 + i + 1,
          name: p.name,
          url: absolute(placePath(map.slug, p.place_id)),
        })),
      },
    },
  );
}

export async function areaDocument(slug: string, key: string, page = 1) {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    key.length > 100
  )
    return missingPage();
  const map = await getMap(slug);
  if (!map) return missingPage();
  const inventory = await getPublicInventory([map.id]);
  const area = seoAreas(inventory).find((area) => area.key === key);
  if (!area) return missingPage();
  const ids = new Set(area.placeIds);
  const all = inventory
    .filter((p) => ids.has(p.place_id))
    .sort(
      (a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id),
    );
  const offset = (page - 1) * 40,
    places = all.slice(offset, offset + 40);
  if (!places.length) return missingPage();
  const base = areaPath(map.slug, key),
    path = areaPath(map.slug, key, page);
  const title = `${areaTitle(map, area)}${page > 1 ? ` · ${page}페이지` : ""}`;
  const description = `${area.label}의 공개 추천 장소 ${all.length}곳. ${places
    .slice(0, 3)
    .map((p) => p.name)
    .join(
      ", ",
    )} 등의 주소와 ${map.title}에 추천하는 이유를 비교해 보세요.`.slice(0, 160);
  const nearby = seoAreas(inventory).filter((a) => a.key !== area.key);
  const body = `<nav aria-label="현재 위치">${link("/discover", "지도 발견")} / ${link(`/maps/${map.slug}/places`, map.title)} / ${escape(area.label)}</nav><h1>${escape(title)}</h1><p class="copy muted">${escape(description)}</p><p>공개 장소 ${all.length}곳 · ${page}페이지 · 장소명순</p><section class="copy"><h2>이 지역에서 비교해 볼 추천 장소</h2><p>${escape(map.description)}</p><p class="muted">아래 주소에 ${escape(area.label)} 지역명이 확인되는 공개 장소를 모았습니다. 각 장소의 추천 이유를 읽고 방문 목적에 맞는 곳을 찾아보세요.</p></section><ul class="cards">${places.map((p) => `<li class="card"><h2>${link(placePath(map.slug, p.place_id), p.name)}</h2><p class="muted">${escape(p.address)}</p><p class="reason">${escape(p.rationale)}</p><div class="actions">${link(placePath(map.slug, p.place_id), "장소 소개 보기")}${link(`/maps/${map.slug}?place=${encodeURIComponent(p.place_id)}`, "지도에서 상세·사진 보기")}</div></li>`).join("")}</ul><nav class="pages" aria-label="지역 장소 목록 페이지">${page > 1 ? link(page === 2 ? base : areaPath(map.slug, key, page - 1), "이전 페이지") : ""}${offset + 40 < all.length ? link(areaPath(map.slug, key, page + 1), "다음 페이지") : ""}</nav>${nearby.length ? `<section><h2>이 지도의 다른 지역</h2><nav class="actions" aria-label="다른 지역 장소 목록">${nearby.map((a) => link(areaPath(map.slug, a.key), `${a.label} · ${a.placeIds.length}곳`, "button")).join("")}</nav></section>` : ""}`;
  return document(title, description, path, body, {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": absolute(path),
        url: absolute(path),
        name: title,
        description,
        inLanguage: "ko",
        spatialCoverage: { "@type": "Place", name: area.label },
        isPartOf: {
          "@type": "CollectionPage",
          name: map.title,
          url: absolute(`/maps/${map.slug}/places`),
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: all.length,
          itemListElement: places.map((p, i) => ({
            "@type": "ListItem",
            position: offset + i + 1,
            name: p.name,
            url: absolute(placePath(map.slug, p.place_id)),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Ting map",
            item: absolute("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: map.title,
            item: absolute(`/maps/${map.slug}/places`),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: area.label,
            item: absolute(base),
          },
        ],
      },
    ],
  });
}
