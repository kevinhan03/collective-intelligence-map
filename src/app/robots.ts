import type { MetadataRoute } from "next";
import { canIndex, siteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: canIndex ? "/" : undefined,
      disallow: canIndex
        ? ["/api/", "/auth/", "/admin/", "/settings/", "/go/"]
        : "/",
    },
    sitemap: canIndex ? `${siteOrigin}/sitemap.xml` : undefined,
  };
}
