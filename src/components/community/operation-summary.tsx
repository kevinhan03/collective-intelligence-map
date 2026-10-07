"use client";
import { useEffect, useState } from "react";
import { operationLabel, type CheckSummary } from "@/domain/visit";

export function OperationSummary({
  id,
  demo,
  revision,
}: {
  id: string;
  demo: boolean;
  revision: number;
}) {
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
        ? operationLabel(summary)
        : error
          ? "최근 운영 확인을 불러오지 못했어요."
          : "운영 확인 불러오는 중…"}
    </p>
  );
}
