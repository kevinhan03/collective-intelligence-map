import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getViewer } from "@/server/queries";
import { getCatalogAdminSnapshot } from "@/server/catalog";
import { CatalogEditor } from "@/components/admin/catalog-editor";
export default async function CatalogAdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin/catalog");
  if (viewer.role !== "admin") notFound();
  let snapshot;
  try {
    snapshot = await getCatalogAdminSnapshot();
  } catch {
    return (
      <main id="main" className="page-wrap">
        <h1>홈 콘텐츠 준비가 필요합니다</h1>
        <p>
          로컬 또는 운영 데이터베이스에 홈 콘텐츠 마이그레이션을 적용한 뒤 다시
          열어 주세요.
        </p>
        <Link href="/admin/moderation">관리로 돌아가기</Link>
      </main>
    );
  }
  return <CatalogEditor initial={snapshot} userId={viewer.id} />;
}
export const instant = false;
