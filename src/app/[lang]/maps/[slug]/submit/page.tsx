import { notFound } from "next/navigation";
import { getMap, getViewer, rendererFor } from "@/server/queries";
import { ProposalForm } from "@/components/community/proposal-form";
import { getTranslator } from "@/i18n/server";
export default async function Submit({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getTranslator();
  const [map, viewer] = await Promise.all([
    getMap((await params).slug),
    getViewer(),
  ]);
  if (!map || map.kind === "creator") notFound();
  return (
    <main id="main" className="page-wrap proposal-page">
      <header className="proposal-intro">
        <p className="kicker">{map.title}</p>
        <h1>{t("pages.suggestAPlace")}</h1>
        <p>{t("pages.shareAGreatPlaceWith")}</p>
      </header>
      <ProposalForm
        map={map}
        enabled={Boolean(viewer)}
        viewerId={viewer?.id}
        autoApprove={viewer?.role === "admin"}
        config={rendererFor()}
      />
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
