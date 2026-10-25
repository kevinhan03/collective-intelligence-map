import { homeMapFirst } from "@/domain/map-order";
import Link from "next/link";
import { MobileDiscovery } from "@/components/community/mobile-discovery";
import { DesktopDiscovery } from "@/components/community/desktop-discovery";
import { getHomeLocationTerms, getMaps } from "@/server/queries";
import { configured } from "@/lib/supabase/server";
import styles from "./page.module.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { jsonLd } from "@/domain/seo";
import { websiteStructuredData } from "@/lib/seo";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default function Home() {
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
          <h1 className="text-3xl font-semibold">
            팅맵 (Ting map) — 취향에 맞는 장소 찾기
          </h1>
          <p className="mt-4 text-muted-foreground">
            빈티지 숍, 타코 맛집, 버거와 음악 공간을 지역과 테마별로 찾아보세요.
            방문자의 추천 이유와 장소 정보를 함께 확인할 수 있습니다.
          </p>
          <p className="mt-4">
            지도 탐색에는 JavaScript가 필요합니다. 장소 소개 페이지는 JavaScript
            없이도 읽을 수 있습니다.
          </p>
          <a
            href="/discover"
            className="mt-4 inline-block text-primary underline"
          >
            지역·취향별 지도 둘러보기
          </a>
        </section>
      </noscript>
      <Suspense fallback={null}>
        <HomeContent />
      </Suspense>
    </>
  );
}
async function HomeContent() {
  const maps = [...(await getMaps())].sort(homeMapFirst);
  const locationTerms = await getHomeLocationTerms(maps);
  return (
    <main id="main" className={`page-wrap ${styles.home}`}>
      <MobileDiscovery
        maps={maps}
        locationTerms={locationTerms}
        demo={!configured()}
      />
      <div className={`hidden ${styles.desktop}`}>
        <DesktopDiscovery
          maps={maps}
          locationTerms={locationTerms}
          demo={!configured()}
        />
      </div>
      <footer
        className={`${styles.footer} flex justify-end border-t text-xs text-muted-foreground`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span>팅맵 · Ting map</span>
          <Link href="/terms" prefetch={false}>
            이용약관
          </Link>
          <Link href="/privacy" prefetch={false}>
            개인정보 처리방침
          </Link>
        </div>
      </footer>
    </main>
  );
}
