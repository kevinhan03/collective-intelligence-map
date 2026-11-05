"use client";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { post } from "./api";
import { useI18n } from "@/i18n/client";
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
  const { t } = useI18n();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  // Kakao rows can remain in the database as historical usage, but this MVP
  // now sends every live lookup to Google Places.
  const googleSettings = data.settings.filter((s) => s.provider === "google");
  const googleEvents = data.events.filter(
    (event) => event.provider === "google",
  );
  return (
    <div className="space-y-8">
      <p className="rounded-lg bg-secondary p-4 text-sm leading-6">
        {t("admin.callLimitsAreCheckedIn")}
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        {googleSettings.map((s) => (
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
                setMessage(t("admin.settingsSaved"));
                router.refresh();
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2 className="text-xl font-semibold">Google Places API</h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.monthlyUsage", {
                count:
                  data.totals.find((total) => total.provider === "google")
                    ?.requests ?? 0,
                cost: (
                  (data.totals.find((total) => total.provider === "google")
                    ?.estimated_micros ?? 0) / 1000000
                ).toFixed(3),
              })}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={s.enabled}
              />
              {t("admin.enableExternalSearch")}
            </label>
            <label className="block text-sm">
              {t("admin.dailyRequestLimit")}
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
              {t("admin.monthlyRequestLimit")}
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
              {t("admin.monthlyReservedBudgetUsd")}
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
              {t("admin.saveSettings")}
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
        <h2 className="mb-4 text-lg font-semibold">
          {t("admin.recentExternalApiRequests")}
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3">{t("admin.providerAction")}</th>
                <th>{t("admin.status")}</th>
                <th>{t("admin.latency")}</th>
                <th>{t("admin.estReservation")}</th>
                <th>{t("admin.time")}</th>
              </tr>
            </thead>
            <tbody>
              {googleEvents.map((e) => (
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
          {!googleEvents.length && (
            <p className="p-6 text-sm text-muted-foreground">
              {t("admin.noExternalApiCallsYet")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
