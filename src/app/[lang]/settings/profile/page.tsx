import { redirect } from "next/navigation";
import { getViewer } from "@/server/queries";
import { ProfileForm } from "@/components/community/profile-form";
import { Button } from "@/components/ui/button";
import { creatorSnapshot } from "@/server/creator";
import { recommendedPlaces } from "@/server/profile";
export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const { edit } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const [snapshot, contributions] = await Promise.all([
    creatorSnapshot(),
    recommendedPlaces(viewer.id)
      .then((items) => ({ count: items.length, error: "" }))
      .catch(() => ({ count: 0, error: "추천 이력을 불러오지 못했습니다." })),
  ]);
  return (
    <main id="main" className="page-wrap profile-page profile-editor-page">
      <ProfileForm
        viewer={viewer}
        snapshot={snapshot}
        recommendationCount={contributions.count}
        contributionError={contributions.error}
        editing={edit === "1"}
      />
      <div className="mt-8 flex items-center justify-between border-t pt-5">
        <span className="text-xs text-muted-foreground">계정</span>
        <form action="/auth/signout" method="post">
          <Button variant="ghost">로그아웃</Button>
        </form>
      </div>
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
