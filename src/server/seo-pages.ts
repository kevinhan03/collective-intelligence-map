import "server-only";
import { getMap } from "./queries";
import {
  getPublicPlace,
  getPublicPlaceDirectory,
  getPublicInventory,
  type PublicInventoryPlace,
} from "./seo-queries";
import { areaPath, areaTheme, seoAreas } from "@/domain/seo-areas";
import type { ThemeMap } from "@/domain/types";
import { jsonLd, mapSearchTitle, placePath } from "@/domain/seo";
import { placeArea } from "@/domain/place-location";
import { directionsUrl } from "@/domain/visit";
import { canIndex, ogImage, siteOrigin, siteVerification } from "@/lib/seo";
import { defaultLocale, localizePath, type Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/dictionaries";
import { indexedLocales } from "@/i18n/metadata";
import { createTranslator, type Translate } from "@/i18n/translate";

type Page = { lang: Locale; t: Translate };
async function pageFor(lang: Locale): Promise<Page> {
  return { lang, t: createTranslator(lang, await getMessages(lang)) };
}

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
const linkTo = ({ lang }: Page, path: string, label: string, className = "") =>
  `<a href="${escape(localizePath(path, lang))}" class="${escape(className)}">${escape(label)}</a>`;

function regionLinks(
  page: Page,
  map: ThemeMap,
  inventory: PublicInventoryPlace[],
  placeId?: string,
) {
  const { t } = page;
  const link = linkTo.bind(null, page);
  const areas = seoAreas(inventory).filter(
    (area) => !placeId || area.placeIds.includes(placeId),
  );
  return areas.length
    ? `<section><h2>${t("seo.browseByArea")}</h2><nav class="actions" aria-label="${escape(t("seo.placesByArea"))}">${areas.map((area) => link(areaPath(map.slug, area.key), t("seo.areaCount", { area: t.area(area.label), count: area.placeIds.length }), "button")).join("")}</nav></section>`
    : "";
}

// These informational routes deliberately return complete HTML rather than a
// PPR shell. AI fetchers do not need React's streaming scripts to read the body.
function document(
  page: Page,
  title: string,
  description: string,
  path: string,
  body: string,
  structured: unknown,
) {
  const { t, lang } = page;
  const link = linkTo.bind(null, page);
  const url = absolute(localizePath(path, lang)),
    image = absolute(ogImage);
  const indexable = canIndex && indexedLocales.includes(lang);
  const verification = [
    ["google-site-verification", siteVerification.google],
    ["msvalidate.01", siteVerification.bing],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => `<meta name="${name}" content="${escape(value!)}">`)
    .join("");
  return new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Ting map</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${indexable ? "index, follow" : "noindex, follow"}"><link rel="canonical" href="${escape(url)}"><link rel="icon" href="/icon.svg"><meta property="og:type" content="website"><meta property="og:site_name" content="Ting map"><meta property="og:locale" content="${lang === "ko" ? "ko_KR" : "en_US"}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}"><style>
  *{box-sizing:border-box}body{margin:0;background:#10151b;color:#f4f5f2;font-family:system-ui,-apple-system,sans-serif;line-height:1.7}a{color:#dbff5e;text-underline-offset:4px}header.site,main,footer{width:calc(100% - 40px);max-width:1200px;margin:auto}.site{display:flex;justify-content:space-between;align-items:center;padding:24px 0;border-bottom:1px solid #ffffff26}.brand{font-size:24px;font-weight:800;text-decoration:none;color:#f4f5f2}main{padding:36px 0 64px}h1{font-size:clamp(28px,4vw,40px);line-height:1.25}h2{font-size:20px;line-height:1.5}.muted{color:#b5bbc4}.copy{max-width:800px}.cards{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.card{border:1px solid #ffffff26;border-radius:20px;padding:24px;background:#1a2028}.reason{white-space:pre-wrap}.actions,nav.pages{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}.button{border:1px solid #ffffff35;border-radius:12px;padding:10px 16px;text-decoration:none}.primary{background:#dbff5e;color:#10151b}footer{border-top:1px solid #ffffff26;padding:16px 0 24px;text-align:right;font-size:12px}footer a{color:#b5bbc4;margin-left:12px}@media(max-width:640px){.cards{grid-template-columns:1fr}.card{padding:20px}.site{padding:16px 0}main{padding-top:24px}} </style><script type="application/ld+json">${jsonLd(structured)}</script>${verification}</head><body><header class="site">${link("/", "Ting map", "brand")}${link("/discover", t("seo.discover"))}</header><main id="main">${body}</main><footer>${link("/terms", t("home.termsOfService"))}${link("/privacy", t("home.privacyPolicy"))}</footer></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
export async function missingPage(lang: Locale = defaultLocale) {
  const { t } = await pageFor(lang);
  return new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><title>${escape(t("seo.placeNotFoundTitle"))}</title></head><body><h1>${escape(t("seo.placeNotFound"))}</h1><a href="${localizePath("/discover", lang)}">${escape(t("seo.backToDiscover"))}</a></body></html>`,
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function unavailablePage(lang: Locale = defaultLocale) {
  const { t } = await pageFor(lang);
  return new Response(t("seo.couldNotLoadPlace"), {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "60",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function placeDocument(
  slug: string,
  id: string,
  lang: Locale = defaultLocale,
) {
  const page = await pageFor(lang);
  const { t } = page;
  const link = linkTo.bind(null, page);
  const map = await getMap(slug);
  const place = map ? await getPublicPlace(map.id, id) : null;
  if (!map || !place) return missingPage(lang);
  const path = placePath(map.slug, place.place_id),
    url = absolute(localizePath(path, lang));
  const directory = `/maps/${map.slug}/places`;
  const title = `${place.name} · ${t.area(placeArea(place.address) || map.city || map.country || "")} · ${map.title}`;
  const description = `${place.address}. ${place.rationale}`.slice(0, 160);
  const regions = regionLinks(
    page,
    map,
    await getPublicInventory([map.id]),
    place.place_id,
  );
  const body = `<nav aria-label="${escape(t("seo.breadcrumb"))}">${link("/discover", t("seo.discover"))} / ${link(directory, map.title)}</nav><article class="copy"><h1>${escape(place.name)}</h1><p class="muted">${escape(t.area(placeArea(place.address)))}</p><p>${escape(place.address)}</p><section class="card"><h2>${escape(t("seo.whyRecommended", { title: map.title }))}</h2><p class="reason">${escape(place.rationale)}</p><p class="muted">${escape(t("seo.contributorLine", { handle: place.handle, date: place.created_at.slice(0, 10) }))}</p>${place.status === "disputed" ? `<p>${escape(t("seo.disputed"))}</p>` : ""}</section><section><h2>${escape(t("seo.beforeYouVisit"))}</h2><p class="muted">${escape(t("seo.beforeYouVisitBody"))}</p><div class="actions">${link(`/maps/${map.slug}?place=${encodeURIComponent(place.place_id)}`, t("seo.viewOnMap"), "button primary")}${link(directionsUrl(place), t("seo.directions"), "button")}</div></section>${link(directory, t("seo.morePlaces", { title: map.title }))}</article>`;
  return document(page, title, description, path, body + regions, {
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
        inLanguage: lang,
        mainEntity: { "@id": `${url}#place` },
        isPartOf: {
          "@type": "CollectionPage",
          name: map.title,
          url: absolute(localizePath(directory, lang)),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Ting map",
            item: absolute(localizePath("/", lang)),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: map.title,
            item: absolute(localizePath(directory, lang)),
          },
          { "@type": "ListItem", position: 3, name: place.name, item: url },
        ],
      },
    ],
  });
}

export async function directoryDocument(
  slug: string,
  page = 1,
  lang: Locale = defaultLocale,
) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return missingPage(lang);
  const context = await pageFor(lang);
  const { t } = context;
  const link = linkTo.bind(null, context);
  const map = await getMap(slug);
  if (!map) return missingPage(lang);
  const [{ places, total }, inventory] = await Promise.all([
    getPublicPlaceDirectory(map.id, page),
    getPublicInventory([map.id]),
  ]);
  if (page > 1 && !places.length) return missingPage(lang);
  const base = `/maps/${map.slug}/places`,
    path = page === 1 ? base : `${base}/page/${page}`;
  const title = `${t("seo.placeListTitle", { title: mapSearchTitle(map) })}${page > 1 ? t("seo.pageSuffix", { page }) : ""}`;
  const body = `${link(`/maps/${map.slug}`, t("seo.exploreOnMap"))}<h1>${escape(title)}</h1><p class="copy muted">${escape(map.description)}</p><p>${escape(t("seo.publicPlacesPage", { count: total, page }))}</p>${!places.length ? `<p>${escape(t("seo.lookingForFirstPlace"))} ${link(`/maps/${map.slug}/submit`, t("seo.suggestFirstPlace"))}</p>` : ""}<ul class="cards">${places.map((p) => `<li class="card"><h2>${link(placePath(map.slug, p.place_id), p.name)}</h2><p class="muted">${escape(p.address)}</p><p>${escape(p.rationale)}</p></li>`).join("")}</ul><nav class="pages" aria-label="${escape(t("seo.placeListPages"))}">${page > 1 ? link(page === 2 ? base : `${base}/page/${page - 1}`, t("seo.previousPage")) : ""}${page * 40 < total ? link(`${base}/page/${page + 1}`, t("seo.nextPage")) : ""}</nav>`;
  return document(
    context,
    title,
    map.description,
    path,
    body + regionLinks(context, map, inventory),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description: map.description,
      url: absolute(localizePath(path, lang)),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: places.map((p, i) => ({
          "@type": "ListItem",
          position: (page - 1) * 40 + i + 1,
          name: p.name,
          url: absolute(localizePath(placePath(map.slug, p.place_id), lang)),
        })),
      },
    },
  );
}

export async function areaDocument(
  slug: string,
  key: string,
  page = 1,
  lang: Locale = defaultLocale,
) {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    key.length > 100
  )
    return missingPage(lang);
  const context = await pageFor(lang);
  const { t } = context;
  const link = linkTo.bind(null, context);
  const map = await getMap(slug);
  if (!map) return missingPage(lang);
  const inventory = await getPublicInventory([map.id]);
  const area = seoAreas(inventory).find((area) => area.key === key);
  if (!area) return missingPage(lang);
  const areaLabel = t.area(area.label);
  const ids = new Set(area.placeIds);
  const all = inventory
    .filter((p) => ids.has(p.place_id))
    .sort(
      (a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id),
    );
  const offset = (page - 1) * 40,
    places = all.slice(offset, offset + 40);
  if (!places.length) return missingPage(lang);
  const base = areaPath(map.slug, key),
    path = areaPath(map.slug, key, page);
  const title = `${t("seo.areaTitle", { area: areaLabel, theme: areaTheme(map) })}${page > 1 ? t("seo.pageSuffix", { page }) : ""}`;
  const description = t("seo.areaDescription", {
    area: areaLabel,
    count: all.length,
    examples: places
      .slice(0, 3)
      .map((p) => p.name)
      .join(", "),
    title: map.title,
  }).slice(0, 160);
  const nearby = seoAreas(inventory).filter((a) => a.key !== area.key);
  const body = `<nav aria-label="${escape(t("seo.breadcrumb"))}">${link("/discover", t("seo.discover"))} / ${link(`/maps/${map.slug}/places`, map.title)} / ${escape(areaLabel)}</nav><h1>${escape(title)}</h1><p class="copy muted">${escape(description)}</p><p>${escape(t("seo.publicPlacesPageByName", { count: all.length, page }))}</p><section class="copy"><h2>${escape(t("seo.compareInArea"))}</h2><p>${escape(map.description)}</p><p class="muted">${escape(t("seo.areaIntro", { area: areaLabel }))}</p></section><ul class="cards">${places.map((p) => `<li class="card"><h2>${link(placePath(map.slug, p.place_id), p.name)}</h2><p class="muted">${escape(p.address)}</p><p class="reason">${escape(p.rationale)}</p><div class="actions">${link(placePath(map.slug, p.place_id), t("seo.viewPlacePage"))}${link(`/maps/${map.slug}?place=${encodeURIComponent(p.place_id)}`, t("seo.viewOnMap"))}</div></li>`).join("")}</ul><nav class="pages" aria-label="${escape(t("seo.areaListPages"))}">${page > 1 ? link(page === 2 ? base : areaPath(map.slug, key, page - 1), t("seo.previousPage")) : ""}${offset + 40 < all.length ? link(areaPath(map.slug, key, page + 1), t("seo.nextPage")) : ""}</nav>${nearby.length ? `<section><h2>${escape(t("seo.otherAreas"))}</h2><nav class="actions" aria-label="${escape(t("seo.otherAreaLists"))}">${nearby.map((a) => link(areaPath(map.slug, a.key), t("seo.areaCount", { area: t.area(a.label), count: a.placeIds.length }), "button")).join("")}</nav></section>` : ""}`;
  return document(context, title, description, path, body, {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": absolute(localizePath(path, lang)),
        url: absolute(localizePath(path, lang)),
        name: title,
        description,
        inLanguage: lang,
        spatialCoverage: { "@type": "Place", name: areaLabel },
        isPartOf: {
          "@type": "CollectionPage",
          name: map.title,
          url: absolute(localizePath(`/maps/${map.slug}/places`, lang)),
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: all.length,
          itemListElement: places.map((p, i) => ({
            "@type": "ListItem",
            position: offset + i + 1,
            name: p.name,
            url: absolute(localizePath(placePath(map.slug, p.place_id), lang)),
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
            item: absolute(localizePath("/", lang)),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: map.title,
            item: absolute(localizePath(`/maps/${map.slug}/places`, lang)),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: areaLabel,
            item: absolute(localizePath(base, lang)),
          },
        ],
      },
    ],
  });
}
