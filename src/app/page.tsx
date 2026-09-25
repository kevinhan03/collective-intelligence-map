import Link from "next/link";
import { MobileDiscovery } from "@/components/community/mobile-discovery";
import { DesktopDiscovery } from "@/components/community/desktop-discovery";
import {
  ArrowRight,
  MapPin,
  Globe2,
  Check,
} from "lucide-react";
import { getInitialPlaces, getMaps } from "@/server/queries";
import { configured } from "@/lib/supabase/server";
import { placeArea } from "@/domain/place-location";
import { SmoothScrollLink } from "@/components/smooth-scroll-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export default async function Home() {
  const maps = [...(await getMaps())].sort(
    (a, b) =>
      b.follower_count - a.follower_count ||
      b.place_count - a.place_count ||
      a.slug.localeCompare(b.slug),
  );
  const placesByMap = await Promise.all(maps.map(getInitialPlaces));
  const locationTerms = Object.fromEntries(
    maps.map((map, index) => [
      map.id,
      placesByMap[index]
        .map((place) => `${place.address} ${placeArea(place.address)}`)
        .join(" "),
    ]),
  );
  return (
    <main id="main" className="page-wrap">
      <MobileDiscovery maps={maps} locationTerms={locationTerms} demo={!configured()} />
      <div className="hidden lg:block">
        <div className="mb-8 flex items-center justify-between border-b pb-5">
          <p className="kicker">A place for shared discoveries</p>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            모두의 발견이 하나의 지도로
          </span>
        </div>
        <section className="grid gap-8 pb-12 pt-4 md:grid-cols-[1.5fr_1fr]">
          <div>
            <Badge variant="secondary" className="mb-5 rounded-full px-3 py-1">
              <Globe2 size={12} />
              취향으로 연결되는 공개 지도
            </Badge>
            <h1 className="text-[38px] leading-[1.24] font-semibold tracking-[-.055em] md:text-[54px]">
              좋은 장소는,
              <br />
              같은 취향의 사람들이
              <br />
              <span className="text-primary">더 잘 아니까.</span>
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
              별점만으로는 알 수 없는 장소의 이야기.
              <br />
              관심사가 같은 사람들과 추천하고 검증하며, 나에게 맞는 곳을
              발견하세요.
            </p>
            <Button asChild className="mt-7 h-11 px-5">
              <SmoothScrollLink href="#communities">
                지도 둘러보기
                <ArrowRight size={16} />
              </SmoothScrollLink>
            </Button>
          </div>
          <div
            className="relative hidden min-h-80 overflow-hidden rounded-2xl glass-panel md:block"
            aria-hidden="true"
          >
            <div className="absolute top-7 left-7 text-xs tracking-[.2em] text-primary">
              PLACES × CONTEXT × COMMUNITY
            </div>
            <div className="absolute top-25 left-7 h-52 w-80 -rotate-12 rounded-xl border-8 border-white/20 bg-[#343b26] shadow-xl">
              <div className="absolute top-7 left-6 h-40 w-56 rounded-[50%] border border-white/80" />
              <div className="absolute top-2 left-16 h-40 w-36 rotate-45 rounded-[50%] border border-white/80" />
              <MapPin
                className="absolute top-12 left-26 text-primary"
                size={40}
              />
              <MapPin
                className="absolute top-26 left-48 text-primary"
                size={30}
              />
            </div>
            <div className="absolute right-5 bottom-10 rotate-3 rounded-xl glass-panel px-5 py-4 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="rounded-full bg-secondary p-1.5">
                  <Check size={14} />
                </span>
                왜 이 주제에 맞나요?
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                한 사람의 발견이, 모두의 지도로.
              </p>
            </div>
            <span className="absolute right-7 bottom-3 font-mono text-[10px] text-primary/60">
              COLLECTIVE FIELD NOTES / 001
            </span>
          </div>
        </section>
        <section id="communities" className="border-t pt-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="kicker mb-2">Find your community</p>
              <h2 className="text-2xl font-semibold tracking-tight">
                지금, 함께 만드는 지도
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              선별된 도시와 주제 · {maps.length}개
            </span>
          </div>
          {!configured() && (
            <p className="mb-5 rounded-lg border border-dashed px-4 py-3 text-xs leading-5 text-muted-foreground">
              미리보기 모드입니다. 장소는 화면 확인을 위한 가상 예시이며 실제
              추천·검증 데이터가 아닙니다.
            </p>
          )}
          <DesktopDiscovery maps={maps} locationTerms={locationTerms} />
        </section>
      </div>
      <footer className="mt-14 flex justify-between border-t pt-5 text-xs text-muted-foreground">
        <span>작은 발견이 모여, 더 나은 선택으로.</span>
        <div className="flex gap-4">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보 처리방침</Link>
        </div>
      </footer>
    </main>
  );
}
