import { Suspense } from "react";
import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/server";
import { getViewer } from "@/server/queries";
import { creatorSnapshot } from "@/server/creator";
import { CreatorStudio } from "@/components/creator/studio";
import { getTranslator } from "@/i18n/server";
async function Content() {
  const t = await getTranslator();
  const viewer = await getViewer();
  if (!viewer) redirect(await localizedPath("/login?next=%2Fstudio"));
  const snapshot = await creatorSnapshot();
  return (
    <main id="main" className="page-wrap max-w-6xl">
      {snapshot ? (
        <CreatorStudio initial={snapshot} viewer={viewer} />
      ) : (
        <>
          <h1 className="text-2xl font-semibold">
            {t("pages.creatorFeaturesComingSoon")}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {t("pages.onceTheDatabaseIsSet")}
          </p>
        </>
      )}
    </main>
  );
}
export default async function Page() {
  const t = await getTranslator();
  return (
    <Suspense
      fallback={<main className="page-wrap">{t("pages.loadingStudio")}</main>}
    >
      <Content />
    </Suspense>
  );
}
export const instant = false;
