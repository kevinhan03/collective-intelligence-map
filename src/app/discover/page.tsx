import type { Metadata } from "next";
import { Suspense } from "react";
import { MapCatalog } from "@/components/community/map-catalog";
import { CatalogLoading } from "@/components/community/catalog-loading";
import { buildCatalog } from "@/domain/map-catalog";
import styles from "@/components/community/catalog-page.module.css";
import { configured } from "@/lib/supabase/server";
import { getCatalogRegions, getMaps } from "@/server/queries";

export const metadata: Metadata = {
  title: "지역·취향별 장소 추천 지도",
  description:
    "빈티지 숍, 맛집, 음악 공간 등 테마별 공개 지도를 둘러보고 장소와 추천 이유를 확인하세요.",
  alternates: { canonical: "/discover" },
};

async function DiscoverMapResults() {
  const maps = await getMaps();

  const regions = await getCatalogRegions(maps);
  return (
    <MapCatalog
      maps={buildCatalog(maps, regions)}
      mode="discover"
      demo={!configured()}
    />
  );
}

export default function DiscoverPage() {
  return (
    <main id="main" className={styles.page} data-catalog-page>
      <Suspense fallback={<CatalogLoading />}>
        <DiscoverMapResults />
      </Suspense>
    </main>
  );
}
