import Link from "@/i18n/link";
import { redirect, notFound } from "next/navigation";
import { localizedPath } from "@/i18n/server";
import { getViewer } from "@/server/queries";
import { db } from "@/lib/supabase/server";
import { hasAdminUsageSession } from "@/server/admin-gate";
import { AdminGateForm } from "@/components/admin/admin-gate-form";
import {
  UsageConsole,
  type UsageSnapshot,
} from "@/components/community/usage-console";
import { getTranslator } from "@/i18n/server";
export default async function Usage() {
  const t = await getTranslator();
  const viewer = await getViewer();
  if (!viewer) redirect(await localizedPath("/login"));
  if (viewer.role !== "admin") notFound();
  if (!(await hasAdminUsageSession()))
    return (
      <main id="main" className="page-wrap max-w-sm">
        <h1 className="mt-5 mb-8 text-3xl font-semibold">
          {t("admin.adminSignIn")}
        </h1>
        <AdminGateForm />
      </main>
    );
  const { data, error } = await (await db()).rpc("usage_snapshot");
  if (error) throw new Error(t("admin.couldnTLoadUsage"));
  return (
    <main id="main" className="page-wrap max-w-4xl">
      <Link href="/admin/moderation" className="text-xs text-muted-foreground">
        {t("admin.communityReview")}
      </Link>
      <h1 className="mt-5 mb-8 text-3xl font-semibold">
        {t("admin.externalApiUsageAndLimits")}
      </h1>
      <UsageConsole data={data as UsageSnapshot} />
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
