"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { post } from "./api";
type Summary = {
  visited: number;
  open: number;
  needs_review: number;
  last_checked_at: string | null;
};
export function PlaceChecks({
  id,
  enabled,
  demo,
}: {
  id: string;
  enabled: boolean;
  demo: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/map-places/${id}/checks`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("확인 기록을 불러오지 못했습니다.");
        return r.json();
      })
      .then(setSummary)
      .catch((e) => {
        if (e.name !== "AbortError") setMessage(e.message);
      });
    return () => controller.abort();
  }, [id, demo, revision]);
  return (
    <section className="rounded-xl border p-4 space-y-3">
      <h3 className="text-sm font-semibold">최근에 다녀오셨나요?</h3>
      <p className="text-xs text-muted-foreground">
        최근 90일의 확인 기록입니다. 한 사람의 최신 응답만 반영합니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["visited", "open", "needs_review"] as const).map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant="outline"
            disabled={!enabled || busy}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                await post("/api/community", {
                  action: "verify_place",
                  id,
                  kind,
                });
                setRevision((v) => v + 1);
                setMessage("확인해 주셔서 고마워요.");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {
              {
                visited: "다녀왔어요",
                open: "운영 중이에요",
                needs_review: "폐업·이전 확인 필요",
              }[kind]
            }{" "}
            {summary?.[kind] ?? 0}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {summary?.last_checked_at
          ? `최근 확인: ${new Date(summary.last_checked_at).toLocaleDateString("ko-KR")}`
          : "최근 확인 기록이 없어요."}
      </p>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
