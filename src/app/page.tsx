import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Users,
  Globe2,
  Sparkles,
  Check,
  MessageCircle,
} from "lucide-react";
import { getMaps } from "@/server/queries";
import { configured } from "@/lib/supabase/server";
import { formatLocation } from "@/domain/location";
import { SmoothScrollLink } from "@/components/smooth-scroll-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
export default async function Home() {
  const maps = await getMaps();
  return (
    <main id="main" className="page-wrap">
      <div className="mb-8 flex items-center justify-between border-b pb-5">
        <p className="kicker">A place for shared discoveries</p>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          도쿄에서 시작합니다
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
              Theme Map 둘러보기
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
        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          {maps.map((map, i) => (
            <Link
              href={`/maps/${map.slug}`}
              key={map.id}
              className="group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative flex h-56 flex-col justify-between overflow-hidden bg-[#24291b] p-7 text-white">
                <div className="absolute -top-24 right-[-70px] size-96 rounded-full border-[45px] border-[#b7cfa0]/10" />
                <div className="absolute -top-13 right-[-30px] size-72 rounded-full border border-[#b7cfa0]/30" />
                <div className="relative flex justify-between">
                  <Badge
                    className="border-white/20 bg-white/10 text-white"
                    variant="outline"
                  >
                    {formatLocation(map)}
                  </Badge>
                  <ArrowUpRight className="opacity-60 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
                <div className="relative">
                  <p className="mb-1 text-xs tracking-[.2em] text-[#edff70]">
                    {`COMMUNITY ${String(i + 1).padStart(3, "0")}`}
                  </p>
                  <h3 className="text-4xl font-medium tracking-tight">
                    {map.title}
                  </h3>
                </div>
              </div>
              <div className="p-6">
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  {map.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {map.tags
                    .filter((t) => t !== "전체")
                    .map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="font-normal"
                      >
                        {t}
                      </Badge>
                    ))}
                </div>
                <div className="mt-6 flex items-center gap-5 border-t pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {map.place_count} 장소
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={14} />
                    {map.follower_count} 팔로워
                  </span>
                  <span className="ml-auto font-medium text-primary">
                    지도 탐색하기 →
                  </span>
                </div>
              </div>
            </Link>
          ))}
          <aside className="flex flex-col justify-between rounded-2xl border border-dashed bg-secondary/30 p-7">
            <div>
              <span className="mb-5 grid size-10 place-items-center rounded-full bg-secondary">
                <Sparkles size={19} />
              </span>
              <p className="kicker">Built together</p>
              <h3 className="mt-3 text-xl leading-8 font-medium">
                추천은 시작이고,
                <br />
                검증이 지도를 만듭니다.
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                누군가 발견한 장소에 방문 경험을 더해 주세요. 구체적인 이유와
                작은 대화가 더 믿을 수 있는 지도를 만듭니다.
              </p>
            </div>
            <div className="mt-7 space-y-4 border-t pt-6 text-sm">
              {[
                [MapPin, "주제에 맞는 장소를 제안하고"],
                [Check, "방문 경험으로 적합도를 검증하고"],
                [MessageCircle, "서로의 관점을 나눠요"],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof MapPin;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <I size={16} className="text-primary" />
                    {text as string}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </section>
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
