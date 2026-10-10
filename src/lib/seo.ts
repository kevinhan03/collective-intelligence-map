import { publicOrigin } from "@/domain/seo";

export const siteOrigin = publicOrigin(process.env.NEXT_PUBLIC_SITE_URL);
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
