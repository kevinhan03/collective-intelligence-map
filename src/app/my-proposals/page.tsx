import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { getViewer } from "@/server/queries";

const proposal = z.object({
  id: z.uuid(),
  place_id: z.uuid(),
  status: z.string(),
  rationale: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  name: z.string(),
  address: z.string(),
  map_slug: z.string(),
  map_title: z.string(),
  rejection_reason: z.string().nullable(),
  reviewed_at: z.string().nullable(),
});

const labels: Record<string, string> = {
  pending: "검토 대기",
  approved: "공개 중",
  rejected: "거절됨",
  disputed: "재검토 중",
  archived: "보관됨",
};

export default async function MyProposals({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fmy-proposals");
  const requested = Number((await searchParams).page ?? "1");
  const page = Number.isSafeInteger(requested) && requested > 0 && requested <= 100000
    ? requested
    : 1;
  const { data, error } = await (await db()).rpc("my_proposals", { page_num: page });
  if (error) throw new Error("내 제안을 불러오지 못했습니다.");
  const rows = z.array(proposal).parse(data);
  const hasNext = rows.length > 20;
  const items = rows.slice(0, 20);

  return (
    <main id="main" className="page-wrap max-w-3xl">
      <p className="kicker mb-3">My proposals</p>
      <h1 className="text-3xl font-semibold">내 제안</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        제안한 장소의 검토 상태와 결과를 확인할 수 있어요.
      </p>
      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border bg-card p-6 text-sm">
          {page === 1 ? "아직 제안한 장소가 없어요." : "이 페이지에는 제안이 없어요."}{" "}
          <Link href="/discover" className="text-primary underline">지도 둘러보기</Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.map_title} · {item.address}
                  </p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs">{labels[item.status] ?? item.status}</span>
              </div>
              <p className="mt-3 text-sm">{item.rationale}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                제안 {new Date(item.created_at).toLocaleDateString("ko-KR")}
                {item.reviewed_at && ` · 처리 ${new Date(item.reviewed_at).toLocaleDateString("ko-KR")}`}
              </p>
              {item.status === "rejected" && item.rejection_reason && (
                <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">
                  거절 사유: {item.rejection_reason}
                </p>
              )}
              {["pending", "approved", "disputed"].includes(item.status) && (
                <Link href={`/maps/${item.map_slug}?proposal=${item.id}`} className="mt-3 inline-block text-sm text-primary underline">
                  지도에서 보기
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
      <nav aria-label="내 제안 페이지" className="mt-6 flex justify-between text-sm">
        {page > 1 ? <Link href={`/my-proposals?page=${page - 1}`} className="underline">이전</Link> : <span />}
        {hasNext && <Link href={`/my-proposals?page=${page + 1}`} className="underline">다음</Link>}
      </nav>
    </main>
  );
}

export const instant = false;
