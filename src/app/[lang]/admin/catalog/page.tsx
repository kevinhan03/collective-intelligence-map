import Link from "@/i18n/link";
import { redirect, notFound } from "next/navigation";
import { localizedPath } from "@/i18n/server";
import { getViewer } from "@/server/queries";
import { getCatalogAdminSnapshot } from "@/server/catalog";
import { CatalogEditor } from "@/components/admin/catalog-editor";
import { getTranslator } from "@/i18n/server";
export default async function CatalogAdminPage() {
  const t = await getTranslator();
  const viewer = await getViewer();
  if (!viewer) redirect(await localizedPath("/login?next=/admin/catalog"));
  if (viewer.role !== "admin") notFound();
  let snapshot;
  try {
    snapshot = await getCatalogAdminSnapshot();
  } catch {
    return (
      <main id="main" className="page-wrap">
        <h1>{t("admin.homeContentNeedsSetup")}</h1>
        <p>{t("admin.applyTheHomeContentMigration")}</p>
        <Link href="/admin/moderation">{t("admin.backToAdmin")}</Link>
      </main>
    );
  }
  return <CatalogEditor initial={snapshot} userId={viewer.id} />;
}
export const instant = false;
