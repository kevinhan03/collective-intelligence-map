import type { Metadata } from "next";
import { Suspense } from "react";
import { MapCatalog } from "@/components/community/map-catalog";
import { UnifiedDesktopHome } from "@/components/community/unified-desktop-home";
import { CatalogLoading } from "@/components/community/catalog-loading";
import { getPublicCatalog } from "@/server/catalog";
import styles from "@/components/community/catalog-page.module.css";
import homeStyles from "../page.module.css";
import { configured } from "@/lib/supabase/server";
import { getLocale, getTranslator } from "@/i18n/server";
import { localeAlternates } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [t, lang] = await Promise.all([getTranslator(), getLocale()]);
  return {
    title: t("meta.discoverTitle"),
    description: t("meta.discoverDescription"),
    alternates: localeAlternates("/discover", lang),
  };
}

async function DiscoverMapResults() {
  const catalog = await getPublicCatalog();
  return (
    <>
      <div className={homeStyles.mobile}>
        <MapCatalog
          maps={catalog}
          mode="discover"
          demo={!configured()}
          engagementSurface="mobile"
        />
      </div>
      <div className={homeStyles.desktop}>
        <UnifiedDesktopHome maps={catalog} demo={!configured()} />
      </div>
    </>
  );
}

export default function DiscoverPage() {
  return (
    <main
      id="main"
      className={`${styles.page} ${homeStyles.home}`}
      data-catalog-page
    >
      <Suspense fallback={<CatalogLoading />}>
        <DiscoverMapResults />
      </Suspense>
    </main>
  );
}
