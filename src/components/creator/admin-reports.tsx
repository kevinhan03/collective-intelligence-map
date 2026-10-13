"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/components/community/api";
export type CreatorAdminSnapshot = {
  reports: {
    id: string;
    map_id: string;
    title: string;
    slug: string;
    reason: string;
    hidden_at: string | null;
  }[];
  actions: {
    id: string;
    action: string;
    map_id: string;
    reason: string;
    created_at: string;
  }[];
};
export function CreatorAdminReports({
  snapshot,
}: {
  snapshot: CreatorAdminSnapshot;
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <details className="mt-8 rounded-xl border p-5">
      <summary className="cursor-pointer font-semibold">
        크리에이터 지도 신고 {snapshot.reports.length}
      </summary>
      {snapshot.reports.map((r) => (
        <article key={r.id} className="mt-4 border-t pt-4">
          <Link href={`/maps/${r.slug}`} className="font-semibold text-primary">
            {r.title}
          </Link>
          <p className="my-2 text-sm">{r.reason}</p>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const action = (
                e.nativeEvent as SubmitEvent
              ).submitter?.getAttribute("value");
              const reason = f.get("reason");
              if (
                !window.confirm(
                  action === "hide"
                    ? `“${r.title}” 지도를 숨길까요? 공개 링크와 커버 접근을 차단하며 신고 처리는 별도입니다.`
                    : "이 신고를 처리 완료할까요? 지도 공개 상태는 유지합니다.",
                )
              )
                return;
              setBusy(true);
              setError("");
              try {
                await post(
                  "/api/creator/maps",
                  action === "hide"
                    ? { action: "hide", mapId: r.map_id, reason }
                    : { action: "resolve_creator_report", id: r.id, reason },
                );
                setMessage("조치를 완료했어요.");
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Textarea
              name="reason"
              minLength={5}
              maxLength={1000}
              required
              aria-label={`${r.title} 조치 사유`}
              placeholder="조치 사유 (5~1,000자)"
            />
            <div className="flex gap-2">
              <Button
                name="operation"
                value="hide"
                variant="outline"
                disabled={busy || Boolean(r.hidden_at)}
              >
                지도 숨김
              </Button>
              <Button name="operation" value="resolve" disabled={busy}>
                신고 처리 완료
              </Button>
            </div>
          </form>
        </article>
      ))}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-primary">
          {message}
        </p>
      )}
      <h3 className="mt-6 font-semibold">지도 운영 이력 · 최근 50건</h3>
      {snapshot.actions.map((a) => (
        <p key={a.id} className="mt-3 break-all text-xs leading-6">
          <strong>
            {a.action === "hide_creator_map"
              ? "지도 숨김"
              : "지도 신고 처리 완료"}
          </strong>{" "}
          · {a.reason}
          <br />
          {a.created_at} · 지도 {a.map_id}
        </p>
      ))}
    </details>
  );
}
