import { homeMapFirst } from "@/domain/map-order";
import Link from "next/link";
import { MobileDiscovery } from "@/components/community/mobile-discovery";
import { DesktopDiscovery } from "@/components/community/desktop-discovery";
import { Globe2 } from "lucide-react";
import { getHomeLocationTerms, getMaps } from "@/server/queries";
import { configured } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import styles from "./page.module.css";
export default async function Home() {
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
        <section
          className={`${styles.desktopSection} grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] xl:gap-16`}
        >
          <div
            className={`${styles.intro} ${styles.desktopIntro} flex min-w-0 flex-col pt-5`}
          >
            <Badge variant="secondary" className="mb-5 rounded-full px-3 py-1">
              <Globe2 size={12} />
              취향으로 연결되는 공개 지도
            </Badge>
            <h1
              className={`${styles.headline} font-heading font-black tracking-[-.085em] text-foreground`}
            >
              <span className="block">좋은 장소는,</span>
              <span className="block">
                같은 <span className="text-[#f97316]">취향</span>의
              </span>
              <span>사람들이</span>
              <span className="block">더 잘 아니까.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
              별점만으로는 알 수 없는 장소의 이야기.
              <br />
              관심사가 같은 사람들과 추천하고 검증하며, 나에게 맞는 곳을
              발견하세요.
            </p>
            <div className="mt-[60px] max-w-lg border-t border-white/15 pt-5">
              <p className="kicker mb-3">How it works</p>
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">01</span>
                  관심 있는 지도 탐색
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">02</span>
                  장소 추천 제안
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">03</span>
                  함께 검증하며 지도 완성
                </li>
              </ol>
            </div>
          </div>
          <div
            id="communities"
            className={`${styles.communities} flex min-w-0 flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur-xl xl:p-7`}
          >
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="kicker mb-2">Find your community</p>
                <h2 className="text-xl font-semibold tracking-tight xl:text-2xl">
                  함께 만드는 지도
                </h2>
              </div>
              <Link
                href="/discover"
                prefetch={false}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                전체 지도 {maps.length}개 보기 →
              </Link>
            </div>
            {!configured() && (
              <p className="mb-5 rounded-lg border border-dashed px-4 py-3 text-xs leading-5 text-muted-foreground">
                미리보기 모드입니다. 장소는 화면 확인을 위한 가상 예시이며 실제
                추천·검증 데이터가 아닙니다.
              </p>
            )}
            <DesktopDiscovery maps={maps} locationTerms={locationTerms} />
          </div>
        </section>
      </div>
      <footer
        className={`${styles.footer} flex justify-between border-t text-xs text-muted-foreground`}
      >
        <span>작은 발견이 모여, 더 나은 선택으로.</span>
        <div className="flex gap-3">
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
