import { ownerMap } from "@/server/creator";
import { getViewer, rendererFor } from "@/server/queries";
import { ProposalForm } from "@/components/community/proposal-form";
import { notFound, redirect } from "next/navigation";
import { localizedPath } from "@/i18n/server";
import { z } from "zod";
import { getTranslator } from "@/i18n/server";
export default async function Add({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslator();
  const viewer = await getViewer();
  if (!viewer) redirect(await localizedPath("/login?next=%2Fstudio"));
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const map = await ownerMap(id.data);
  return (
    <main id="main" className="page-wrap proposal-page">
      <header className="proposal-intro">
        <p className="kicker">{map.title}</p>
        <h1>{t("pages.addAPlaceToMy")}</h1>
        <p>
          {map.status === "published"
            ? t("pages.placesYouAddArePublished")
            : t("pages.newPlacesInADraft")}
        </p>
      </header>
      <ProposalForm
        map={map}
        enabled
        viewerId={viewer.id}
        autoApprove
        config={rendererFor()}
        creator
      />
    </main>
  );
}
export const instant = false;
