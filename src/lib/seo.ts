import { publicOrigin } from "@/domain/seo";

export const siteOrigin = publicOrigin(process.env.NEXT_PUBLIC_SITE_URL);
export const siteName = "팅맵";
export const siteTitle = "팅맵 (Ting map) — 취향이 모이는 지도";
export const siteDescription =
  "팅맵(Ting map)은 취향이 같은 사람들이 함께 만드는 장소 추천 지도입니다. 패션 매장, 빈티지 숍, 라멘·타코·버거 맛집을 찾고, 방문자의 추천 이유와 사진을 확인하세요.";
export const websiteStructuredData = siteOrigin
  ? {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteOrigin}/#website`,
      name: siteName,
      alternateName: ["Ting map", "Tingmap"],
      url: `${siteOrigin}/`,
      description: siteDescription,
      inLanguage: "ko-KR",
    }
  : null;
export const canIndex = Boolean(
  siteOrigin &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  process.env.VERCEL_ENV !== "preview",
);
export const noIndex = { index: false, follow: true };
export const ogImage = "/glass-neighborhood-og.jpg";
// Ownership tokens are public, but belong only to the production site.
export const siteVerification = canIndex
  ? {
      google: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
      bing: process.env.BING_SITE_VERIFICATION?.trim() || undefined,
    }
  : {};
