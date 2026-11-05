"use client";
import { useEffect, useState } from "react";
import { operationLabel, type CheckSummary } from "@/domain/visit";

import { useI18n } from "@/i18n/client";
import { intlLocale } from "@/i18n/config";
export function OperationSummary({
  id,
  demo,
  revision,
}: {
  id: string;
  demo: boolean;
  revision: number;
}) {
  const { t, lang } = useI18n();
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/map-places/${id}/checks`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setSummary)
      .catch((error) => {
        if (error.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [id, demo, revision]);
  if (demo) return null;
  return (
    <p
      role="status"
      className={`text-xs ${summary?.needs_review ? "text-amber-600" : "text-muted-foreground"}`}
    >
      {summary
        ? t.message(operationLabel(summary, intlLocale(lang)))
        : error
          ? t("map.couldnTLoadRecentVisit")
          : t("map.loadingVisitChecks")}
    </p>
  );
}
