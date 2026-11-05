"use client";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import Link from "@/i18n/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/components/community/api";
import { useI18n } from "@/i18n/client";
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
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <details className="mt-8 rounded-xl border p-5">
      <summary className="cursor-pointer font-semibold">
        {t("admin.creatorMapReports", { count: snapshot.reports.length })}
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
                    ? t("admin.hideTheMapThisBlocks", { title: r.title })
                    : t("admin.resolveThisReportTheMap"),
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
                setMessage(t("admin.actionCompleted"));
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
              aria-label={t("admin.reasonForActionOn", { title: r.title })}
              placeholder={t("admin.reasonForAction51")}
            />
            <div className="flex gap-2">
              <Button
                name="operation"
                value="hide"
                variant="outline"
                disabled={busy || Boolean(r.hidden_at)}
              >
                {t("admin.hideMap")}
              </Button>
              <Button name="operation" value="resolve" disabled={busy}>
                {t("admin.reportResolved")}
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
      <h3 className="mt-6 font-semibold">
        {t("admin.mapModerationLogLast50")}
      </h3>
      {snapshot.actions.map((a) => (
        <p key={a.id} className="mt-3 break-all text-xs leading-6">
          <strong>
            {a.action === "hide_creator_map"
              ? t("admin.hideMap")
              : t("admin.mapReportResolved")}
          </strong>{" "}
          · {a.reason}
          <br />
          {a.created_at} {t("admin.map")} {a.map_id}
        </p>
      ))}
    </details>
  );
}
