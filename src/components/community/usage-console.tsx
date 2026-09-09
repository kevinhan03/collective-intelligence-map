"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { post } from "./api";
type Settings = {
  provider: "google" | "kakao";
  enabled: boolean;
  daily_limit: number;
  monthly_limit: number;
  monthly_budget_micros: number;
};
export type UsageSnapshot = {
  settings: Settings[];
  events: {
    id: string;
    provider: string;
    operation: string;
    status: string;
    estimated_micros: number;
    latency_ms: number;
    created_at: string;
  }[];
  totals: { provider: string; requests: number; estimated_micros: number }[];
};
export function UsageConsole({ data }: { data: UsageSnapshot }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="space-y-8">
      <p className="rounded-lg bg-secondary p-4 text-sm leading-6">
        호출 한도는 요청 전에 DB에서 검사합니다. 아래 금액은 보수적인 예약
        추정치이며 실제 청구액이 아닙니다. 제공자 콘솔의 쿼터도 함께 제한해
        주세요.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        {data.settings.map((s) => (
          <form
            key={s.provider}
            className="space-y-4 rounded-xl border bg-card p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setMessage("");
              try {
                await post("/api/community", {
                  action: "provider_settings",
                  provider: s.provider,
                  enabled: f.get("enabled") === "on",
                  daily_limit: Number(f.get("daily")),
                  monthly_limit: Number(f.get("monthly")),
                  monthly_budget_micros: Math.round(
                    Number(f.get("budget")) * 1000000,
                  ),
                });
                setMessage("설정을 저장했습니다.");
                router.refresh();
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2 className="text-xl font-semibold capitalize">{s.provider}</h2>
            <p className="text-xs text-muted-foreground">
              이번 달{" "}
              {data.totals.find((t) => t.provider === s.provider)?.requests ??
                0}
              회 · 추정 $
              {(
                (data.totals.find((t) => t.provider === s.provider)
                  ?.estimated_micros ?? 0) / 1000000
              ).toFixed(3)}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={s.enabled}
              />
              외부 검색 활성화
            </label>
            <label className="block text-sm">
              일일 요청 한도
              <Input
                className="mt-2"
                name="daily"
                type="number"
                min={0}
                max={10000}
                defaultValue={s.daily_limit}
                required
              />
            </label>
            <label className="block text-sm">
              월간 요청 한도
              <Input
                className="mt-2"
                name="monthly"
                type="number"
                min={0}
                max={100000}
                defaultValue={s.monthly_limit}
                required
              />
            </label>
            <label className="block text-sm">
              월간 예약 예산 (USD)
              <Input
                className="mt-2"
                name="budget"
                type="number"
                min={0}
                max={1000}
                step="0.01"
                defaultValue={s.monthly_budget_micros / 1000000}
                required
              />
            </label>
            <Button disabled={busy} size="sm">
              설정 저장
            </Button>
          </form>
        ))}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <section>
        <h2 className="mb-4 text-lg font-semibold">최근 외부 API 요청</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3">공급자 / 작업</th>
                <th>상태</th>
                <th>지연</th>
                <th>예약 추정</th>
                <th>시각</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-3">
                    {e.provider} / {e.operation}
                  </td>
                  <td>{e.status}</td>
                  <td>{e.latency_ms ?? "—"}ms</td>
                  <td>${(e.estimated_micros / 1000000).toFixed(4)}</td>
                  <td className="pr-3">
                    {new Date(e.created_at).toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.events.length && (
            <p className="p-6 text-sm text-muted-foreground">
              아직 외부 API 호출이 없습니다.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
