import { ownerMap } from "@/server/creator";
import { getViewer, rendererFor } from "@/server/queries";
import { ProposalForm } from "@/components/community/proposal-form";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
export default async function Add({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fstudio");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const map = await ownerMap(id.data);
  return (
    <main id="main" className="page-wrap proposal-page">
      <header className="proposal-intro">
        <p className="kicker">{map.title}</p>
        <h1>내 지도에 장소 추가</h1>
        <p>
          {map.status === "published"
            ? "추가한 장소는 즉시 공개됩니다."
            : "초안의 새 장소는 지도를 공개하기 전까지 공개 검색에 표시되지 않습니다."}
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
