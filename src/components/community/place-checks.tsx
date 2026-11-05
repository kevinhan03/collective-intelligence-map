"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { post } from "./api";
import { useI18n } from "@/i18n/client";
import { intlLocale } from "@/i18n/config";
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
  onChange,
}: {
  id: string;
  enabled: boolean;
  demo: boolean;
  onChange?: () => void;
}) {
  const { t, lang } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/map-places/${id}/checks`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(t("map.couldnTLoadVisitChecks"));
        return r.json();
      })
      .then(setSummary)
      .catch((e) => {
        if (e.name !== "AbortError") setMessage(t.message(e.message));
      });
    return () => controller.abort();
  }, [id, demo, revision, t]);
  return (
    <section className="rounded-xl border p-4 space-y-3">
      <h3 className="text-sm font-semibold">{t("map.beenHereRecently")}</h3>
      <p className="text-xs text-muted-foreground">
        {t("map.visitChecksFromTheLast")}
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
                onChange?.();
                setMessage(t("map.thanksForChecking"));
              } catch (e) {
                setMessage(t.message((e as Error).message));
              } finally {
                setBusy(false);
              }
            }}
          >
            {
              {
                visited: t("map.iVisited"),
                open: t("map.itSOpen"),
                needs_review: t("map.mayBeClosedOrMoved"),
              }[kind]
            }{" "}
            {summary?.[kind] ?? 0}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {summary?.last_checked_at
          ? t("map.lastChecked", {
              date: new Date(summary.last_checked_at).toLocaleDateString(
                intlLocale(lang),
              ),
            })
          : t("map.noRecentVisitChecks")}
      </p>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
