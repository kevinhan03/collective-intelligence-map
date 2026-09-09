import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getViewer } from "@/server/queries";
import { db } from "@/lib/supabase/server";
import {
  AdminConsole,
  type AdminSnapshot,
} from "@/components/community/admin-console";
export default async function Moderation() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "admin") notFound();
  const { data, error } = await (await db()).rpc("admin_snapshot");
  if (error) throw new Error("검토 목록을 불러올 수 없습니다.");
  return (
    <main id="main" className="page-wrap max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="kicker mb-2">Community operations</p>
          <h1 className="text-3xl font-semibold">커뮤니티 검토</h1>
        </div>
        <Link href="/admin/usage" className="text-sm underline">
          API 사용량 →
        </Link>
      </div>
      <AdminConsole snapshot={data as AdminSnapshot} />
    </main>
  );
}
