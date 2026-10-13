import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/queries";
import { creatorSnapshot } from "@/server/creator";
import { CreatorStudio } from "@/components/creator/studio";
async function Content() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fstudio");
  const snapshot = await creatorSnapshot();
  return (
    <main id="main" className="page-wrap max-w-6xl">
      {snapshot ? (
        <CreatorStudio initial={snapshot} viewer={viewer} />
      ) : (
        <>
          <h1 className="text-2xl font-semibold">크리에이터 기능 준비 중</h1>
          <p className="mt-4 text-muted-foreground">
            DB 설정이 적용되면 나의 장소 링크를 만들 수 있어요. 기존 지도 탐색과
            장소 제안은 계속 이용할 수 있습니다.
          </p>
        </>
      )}
    </main>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={<main className="page-wrap">스튜디오 불러오는 중…</main>}
    >
      <Content />
    </Suspense>
  );
}
export const instant = false;
