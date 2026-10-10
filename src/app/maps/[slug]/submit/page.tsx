import { notFound } from "next/navigation";
import { getMap, getViewer, rendererFor } from "@/server/queries";
import { ProposalForm } from "@/components/community/proposal-form";
export default async function Submit({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [map, viewer] = await Promise.all([
    getMap((await params).slug),
    getViewer(),
  ]);
  if (!map) notFound();
  return (
    <main id="main" className="page-wrap proposal-page">
      <header className="proposal-intro">
        <p className="kicker">{map.title}</p>
        <h1>장소 제안</h1>
        <p>좋은 장소를 더 많은 사람들과 공유해 주세요.</p>
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
