"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { post } from "./api";
type Proposal = {
  id: string;
  place_id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
  rationale: string;
  source_note: string;
  status: string;
  map_title: string;
  handle: string;
  created_at: string;
  last_verified_at: string | null;
  review_count?: number;
  negative_count?: number;
};
type Report = {
  id: string;
  reason: string;
  map_place_id: string | null;
  comment_id: string | null;
  created_at: string;
  body?: string;
  name?: string;
};
type Action = {
  id: string;
  action: string;
  reason: string;
  created_at: string;
};
type Duplicate = {
  source_id: string;
  source_name: string;
  target_id: string;
  target_name: string;
  distance_m: number;
};
export type AdminSnapshot = {
  proposals: Proposal[];
  reports: Report[];
  actions: Action[];
  duplicates: Duplicate[];
};
export function AdminConsole({ snapshot }: { snapshot: AdminSnapshot }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("pending");
  const proposals = snapshot.proposals
    .filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        `${p.name} ${p.map_title} ${p.handle}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (b.review_count ?? 0) +
        (b.negative_count ?? 0) -
        ((a.review_count ?? 0) + (a.negative_count ?? 0)),
    );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState<{
      action: string;
      id: string;
      status?: string;
      targetId?: string;
      description: string;
    } | null>(null);
  async function execute() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const { description: _, ...payload } = pending;
      void _;
      await post("/api/community", { ...payload, reason });
      setPending(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-5 text-xl font-semibold">
          장소 검토{" "}
          <span className="text-muted-foreground">
            {snapshot.proposals.filter((p) => p.status === "pending").length}
          </span>
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries({
            pending: "승인 대기",
            disputed: "재검토",
            approved: "공개 중",
            all: "전체",
          }).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
          <Input
            aria-label="검토할 장소 검색"
            placeholder="장소·테마·기여자 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {proposals.length === 0 && (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            검토할 장소가 없습니다.
          </p>
        )}
        <div className="space-y-4">
          {proposals.map((p) => (
            <article key={p.id} className="rounded-xl border bg-card p-5">
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold">{p.name}</h3>
                <Badge variant="secondary">{p.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {p.map_title} · @{p.handle} · {p.address}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                위치: {p.lat}, {p.lng}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                확인 필요 {p.review_count ?? 0}건 · 부적합{" "}
                {p.negative_count ?? 0}표
                {(!p.last_verified_at ||
                  now - Date.parse(p.last_verified_at) > 90 * 86400000) &&
                  " · 최근 90일 검증 없음"}
              </p>
              <p className="mt-4 text-sm leading-7">{p.rationale}</p>
              <div className="my-4 rounded-lg bg-secondary/50 p-3 text-xs leading-6">
                <strong>이름·주소·좌표 출처</strong>
                <p>{p.source_note || "출처 누락 — 승인 불가"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(p.status === "pending"
                  ? ["approved", "rejected"]
                  : p.status === "approved"
                    ? ["disputed", "archived"]
                    : ["approved", "archived"]
                ).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "approved" ? "default" : "outline"}
                    onClick={() =>
                      setPending({
                        action: "moderate",
                        id: p.id,
                        status,
                        description: `${p.name}: ${status === "approved" ? "독립적인 데이터 출처와 주제 적합성을 확인하고 승인합니다." : status === "rejected" ? "제안을 거절합니다." : status === "disputed" ? "검토 필요 상태로 표시합니다." : "공개 지도에서 보관 처리합니다."}`,
                      })
                    }
                  >
                    {
                      {
                        approved: "승인",
                        rejected: "거절",
                        disputed: "검토 필요",
                        archived: "보관",
                      }[status]
                    }
                  </Button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-5 text-xl font-semibold">중복 후보</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          100m 이내 장소입니다. 같은 건물의 다른 매장인지 확인한 후 병합하세요.
        </p>
        {snapshot.duplicates.map((d, i) => (
          <article
            key={i}
            className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4"
          >
            <div>
              <p className="text-sm font-medium">
                {d.source_name} → {d.target_name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                거리 {d.distance_m}m · 최신 사용자 표 한 개를 유지하고
                댓글·저장을 합칩니다.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setPending({
                  action: "merge",
                  id: d.source_id,
                  targetId: d.target_id,
                  description: `“${d.source_name}”을 “${d.target_name}”으로 병합합니다. 원본 장소는 병합 이력과 연결을 남기고, 관계·댓글·저장을 대표 장소로 이동합니다. 같은 사용자의 중복 표는 최신 표 하나를 유지합니다.`,
                })
              }
            >
              병합 검토
            </Button>
          </article>
        ))}
        {snapshot.duplicates.length === 0 && (
          <p className="text-sm text-muted-foreground">중복 후보가 없습니다.</p>
        )}
      </section>
      <section>
        <h2 className="mb-5 text-xl font-semibold">
          신고 {snapshot.reports.length}
        </h2>
        {snapshot.reports.map((r) => (
          <article key={r.id} className="mb-4 rounded-lg border bg-card p-5">
            <p className="text-xs text-muted-foreground">
              {r.comment_id ? "댓글 신고" : "장소 신고"} ·{" "}
              {new Date(r.created_at).toLocaleDateString("ko-KR")}
            </p>
            {(r.body || r.name) && (
              <p className="my-3 rounded bg-secondary p-3 text-sm">
                {r.body ?? r.name}
              </p>
            )}
            <p className="my-4 text-sm">{r.reason}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPending({
                    action: "resolve_report",
                    id: r.id,
                    description:
                      "신고를 검토 완료로 처리합니다. 콘텐츠 상태는 별도 조치로 변경합니다.",
                  })
                }
              >
                처리 완료
              </Button>
              {r.comment_id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPending({
                      action: "hide_comment",
                      id: r.comment_id!,
                      description: "신고된 댓글을 공개 화면에서 숨깁니다.",
                    })
                  }
                >
                  댓글 숨기기
                </Button>
              )}
              {r.map_place_id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPending({
                      action: "moderate",
                      id: r.map_place_id!,
                      status: "disputed",
                      description: "신고된 장소를 검토 필요 상태로 변경합니다.",
                    })
                  }
                >
                  장소 검토 필요
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
      <section>
        <h2 className="mb-5 text-xl font-semibold">최근 운영 이력</h2>
        <div className="divide-y rounded-lg border bg-card">
          {snapshot.actions.map((a) => (
            <div key={a.id} className="p-4">
              <span className="text-xs font-semibold">{a.action}</span>
              <p className="mt-1 text-sm">{a.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString("ko-KR")}
              </p>
            </div>
          ))}
        </div>
      </section>
      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPending(null);
            setReason("");
            setError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>운영 조치를 확인해 주세요</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="moderation-reason" className="text-sm font-medium">
            처리 근거
          </label>
          <Textarea
            id="moderation-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            maxLength={1000}
            placeholder="검토한 출처와 판단 이유를 기록해 주세요."
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {[
              "주제 적합성과 장소 정보를 확인했습니다.",
              "주제에 맞는 추천 근거가 부족합니다.",
              "중복 장소로 확인했습니다.",
              "폐업 또는 이전 여부를 확인했습니다.",
            ].map((text) => (
              <Button
                key={text}
                size="sm"
                variant="outline"
                onClick={() => setReason(text)}
              >
                {text}
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <Button
              onClick={execute}
              disabled={busy || reason.trim().length < 5}
            >
              {busy ? "처리 중" : "확인하고 실행"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
