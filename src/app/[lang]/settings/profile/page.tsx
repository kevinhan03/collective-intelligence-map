import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/server";
import { getViewer } from "@/server/queries";
import { ProfileForm } from "@/components/community/profile-form";
import { Button } from "@/components/ui/button";
import { creatorSnapshot } from "@/server/creator";
import { recommendedPlaces } from "@/server/profile";
import { getTranslator } from "@/i18n/server";
export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const t = await getTranslator();
  const { edit } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(await localizedPath("/login"));
  const [snapshot, contributions] = await Promise.all([
    creatorSnapshot(),
    recommendedPlaces(viewer.id)
      .then((items) => ({ count: items.length, error: "" }))
      .catch(() => ({
        count: 0,
        error: t("pages.couldnTLoadYourRecommendation"),
      })),
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
        <span className="text-xs text-muted-foreground">
          {t("pages.account")}
        </span>
        <form action="/auth/signout" method="post">
          <Button variant="ghost">{t("pages.signOut")}</Button>
        </form>
      </div>
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
