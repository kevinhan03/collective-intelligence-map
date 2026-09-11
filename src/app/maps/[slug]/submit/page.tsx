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
    <main id="main" className="page-wrap max-w-2xl">
      <p className="kicker mb-3">Contribute to {map.title}</p>
      <h1 className="text-3xl font-semibold">나만 알기 아까운 곳이 있나요?</h1>
      <p className="mt-4 mb-8 text-sm leading-7 text-muted-foreground">
        장소와 함께, 이 주제에 어울리는 이유를 남겨 주세요.
        <br />
        함께 검토하고 믿을 수 있는 지도를 만듭니다.
      </p>
      <ProposalForm
        map={map}
        enabled={Boolean(viewer && viewer.role !== "member")}
        config={rendererFor(map)}
      />
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
