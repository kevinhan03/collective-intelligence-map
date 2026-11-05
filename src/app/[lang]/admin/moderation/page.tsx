import {
  CreatorAdminReports,
  type CreatorAdminSnapshot,
} from "@/components/creator/admin-reports";
import Link from "@/i18n/link";
import { redirect, notFound } from "next/navigation";
import { localizedPath } from "@/i18n/server";
import { getViewer } from "@/server/queries";
import { db } from "@/lib/supabase/server";
import {
  AdminConsole,
  type AdminSnapshot,
} from "@/components/community/admin-console";
import { getTranslator } from "@/i18n/server";
export default async function Moderation() {
  const t = await getTranslator();
  const viewer = await getViewer();
  if (!viewer) redirect(await localizedPath("/login"));
  if (viewer.role !== "admin") notFound();
  const { data, error } = await (await db()).rpc("admin_snapshot");
  const creator = await (await db()).rpc("creator_admin_snapshot");
  if (error) throw new Error(t("admin.couldnTLoadTheReview"));
  return (
    <main id="main" className="page-wrap max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="kicker mb-2">Community operations</p>
          <h1 className="text-3xl font-semibold">
            {t("admin.communityReview2")}
          </h1>
        </div>
        <Link href="/admin/catalog" className="text-sm underline">
          {t("admin.homeContent2")}
        </Link>
        <Link href="/admin/usage" className="text-sm underline">
          {t("admin.apiUsage")}
        </Link>
      </div>
      <AdminConsole snapshot={data as AdminSnapshot} />
      {creator.data && (
        <CreatorAdminReports
          snapshot={creator.data as unknown as CreatorAdminSnapshot}
        />
      )}
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
