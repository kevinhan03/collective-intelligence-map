import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getViewer } from "@/server/queries";
import { db } from "@/lib/supabase/server";
import { hasAdminUsageSession } from "@/server/admin-gate";
import { AdminGateForm } from "@/components/admin/admin-gate-form";
import {
  UsageConsole,
  type UsageSnapshot,
} from "@/components/community/usage-console";
export default async function Usage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "admin") notFound();
  if (!(await hasAdminUsageSession()))
    return (
      <main id="main" className="page-wrap max-w-sm">
        <h1 className="mt-5 mb-8 text-3xl font-semibold">관리자 인증</h1>
        <AdminGateForm />
      </main>
    );
  const { data, error } = await (await db()).rpc("usage_snapshot");
  if (error) throw new Error("사용량을 불러올 수 없습니다.");
  return (
    <main id="main" className="page-wrap max-w-4xl">
      <Link href="/admin/moderation" className="text-xs text-muted-foreground">
        ← 커뮤니티 검토
      </Link>
      <h1 className="mt-5 mb-8 text-3xl font-semibold">
        외부 API 사용량과 한도
      </h1>
      <UsageConsole data={data as UsageSnapshot} />
    </main>
  );
}
