"use client";
import { Component, type ReactNode } from "react";

import { useI18n } from "@/i18n/client";
export function MapFailure({
  message,
  onFallback,
}: {
  message?: string;
  onFallback?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="map-failure rounded-xl border bg-card p-4 text-sm"
    >
      <p>{message ?? t("map.couldnTLoadTheMap")}</p>
      {onFallback ? (
        <button
          className="mt-2 min-h-11 rounded-lg border px-4 font-semibold"
          onClick={onFallback}
        >
          {t("map.viewAsList")}
        </button>
      ) : (
        <p className="mt-2">{t("map.youCanStillUseThe")}</p>
      )}
    </div>
  );
}

export class MapErrorBoundary extends Component<
  { children: ReactNode; onFallback?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <MapFailure onFallback={this.props.onFallback} />
    ) : (
      this.props.children
    );
  }
}
