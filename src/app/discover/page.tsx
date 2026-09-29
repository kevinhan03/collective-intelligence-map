import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverMaps } from "@/components/community/discover-maps";
import { configured } from "@/lib/supabase/server";
import { getMaps } from "@/server/queries";

export const metadata: Metadata = { title: "지도 발견" };

async function DiscoverMapResults() {
  const maps = await getMaps();

  return <DiscoverMaps maps={maps} />;
}

function DiscoverMapResultsFallback() {
  return (
    <div
      aria-busy="true"
      aria-label="지도 목록 불러오는 중"
      className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="h-[22rem] animate-pulse rounded-3xl border border-white/15 bg-white/5"
        />
      ))}
    </div>
  );
}

export default function DiscoverPage() {

  return (
    <main id="main" className="page-wrap pb-20">
      <div className="mb-9 max-w-2xl">
        <p className="kicker mb-3">Discover maps</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          취향에 맞는 지도를 찾아보세요.
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          지역과 테마를 골라, 함께 발견하고 검증하는 지도를 둘러보세요.
        </p>
      </div>
      {!configured() && (
        <p className="mb-5 rounded-xl border border-dashed px-4 py-3 text-xs leading-5 text-muted-foreground">
          미리보기 모드입니다. 장소와 추천 내용은 화면 확인용 가상 예시입니다.
        </p>
      )}
      <Suspense fallback={<DiscoverMapResultsFallback />}>
        <DiscoverMapResults />
      </Suspense>
    </main>
  );
}
