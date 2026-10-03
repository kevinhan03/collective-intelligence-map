"use client";
import { Component, type ReactNode } from "react";

export function MapFailure({
  message = "지도를 불러오지 못했습니다.",
  onFallback,
}: {
  message?: string;
  onFallback?: () => void;
}) {
  return (
    <div
      role="alert"
      className="map-failure rounded-xl border bg-card p-4 text-sm"
    >
      <p>{message}</p>
      {onFallback ? (
        <button
          className="mt-2 min-h-11 rounded-lg border px-4 font-semibold"
          onClick={onFallback}
        >
          목록으로 보기
        </button>
      ) : (
        <p className="mt-2">장소 목록은 계속 이용할 수 있습니다.</p>
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
