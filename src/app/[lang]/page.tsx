import Link from "@/i18n/link";
import { MapCatalog } from "@/components/community/map-catalog";
import { UnifiedDesktopHome } from "@/components/community/unified-desktop-home";
import { CatalogLoading } from "@/components/community/catalog-loading";
import { getPublicCatalog } from "@/server/catalog";
import { configured } from "@/lib/supabase/server";
import styles from "@/components/community/catalog-page.module.css";
import homeStyles from "./page.module.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { jsonLd } from "@/domain/seo";
import { websiteStructuredData } from "@/lib/seo";
import { getLocale, getTranslator } from "@/i18n/server";
import { localeAlternates } from "@/i18n/metadata";
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates("/", await getLocale()) };
}
export default async function Home() {
  const t = await getTranslator();
  return (
    <>
      {websiteStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteStructuredData) }}
        />
      )}
      <noscript>
        <section className="page-wrap pb-10">
          <h1 className="text-3xl font-semibold">{t("home.noscriptTitle")}</h1>
          <p className="mt-4 text-muted-foreground">
            {t("home.noscriptDescription")}
          </p>
          <p className="mt-4">{t("home.noscriptJavascript")}</p>
          <Link
            href="/discover"
            prefetch={false}
            className="mt-4 inline-block text-primary underline"
          >
            {t("home.noscriptBrowse")}
          </Link>
        </section>
      </noscript>
      <Suspense
        fallback={
          <main id="main" className={styles.page} data-catalog-page>
            <CatalogLoading />
          </main>
        }
      >
        <HomeContent />
      </Suspense>
    </>
  );
}
async function HomeContent() {
  const t = await getTranslator();
  const catalog = await getPublicCatalog();
  return (
    <main
      id="main"
      className={`${styles.page} ${homeStyles.home}`}
      data-catalog-page
    >
      <div className={homeStyles.mobile}>
        <MapCatalog
          maps={catalog}
          mode="home"
          demo={!configured()}
          engagementSurface="mobile"
        />
      </div>
      <div className={homeStyles.desktop}>
        <UnifiedDesktopHome maps={catalog} demo={!configured()} />
      </div>
      <footer className={homeStyles.footer}>
        <div className="flex flex-wrap items-center gap-2">
          <span>{t("home.tingMap")}</span>
          <Link href="/terms" prefetch={false}>
            {t("home.termsOfService")}
          </Link>
          <Link href="/privacy" prefetch={false}>
            {t("home.privacyPolicy")}
          </Link>
        </div>
      </footer>
    </main>
  );
}
