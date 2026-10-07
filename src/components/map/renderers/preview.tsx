"use client";
import type { MapProps } from "../types";
import { ThumbsUp } from "lucide-react";
import { pinCount } from "../pin-content";
export default function PreviewMap({ places, selected, onSelect }: MapProps) {
  return (
    <div
      className="map-grid relative h-full min-h-[420px] overflow-hidden"
      aria-label="가상 장소 지도 미리보기"
    >
      <div className="absolute -top-10 left-[14%] h-[120%] w-30 rotate-[-24deg] rounded-full bg-[#dde5ce]" />
      <div className="map-street top-[30%] -left-10 h-4 w-[120%] rotate-[-18deg]" />
      <div className="map-street top-[68%] -left-10 h-3 w-[120%] rotate-[11deg]" />
      <div className="map-street -top-10 left-[54%] h-[120%] w-4 rotate-[18deg]" />
      <div className="map-street -top-10 left-[77%] h-[120%] w-2 rotate-[-8deg]" />
      <span className="absolute top-15 left-10 text-[10px] tracking-[.18em] text-[#869278]">
        COLLECTIVE FIELD MAP
      </span>
      <span className="absolute top-[43%] left-[38%] text-[10px] tracking-widest text-[#9aa38e]">
        TOKYO FASHION
      </span>
      {places.map((p) => (
        <button
          key={p.id}
          className="map-pin"
          data-selected={selected === p.id}
          data-status={p.status}
          aria-label={`${p.name} 지도에서 선택 · 주제 추천 ${p.positive}${p.status === "pending" ? " · 검토 대기" : ""}`}
          onClick={() => onSelect(p.id)}
          style={{
            left: `${18 + (p.lng - 139.69) * 1900}%`,
            top: `${78 - (p.lat - 35.655) * 2600}%`,
          }}
        >
          {p.status === "pending" ? (
            <span aria-hidden="true">···</span>
          ) : (
            <span className="map-pin-likes" aria-hidden="true">
              <ThumbsUp />
              {p.positive > 0 && <span>{pinCount(p.positive)}</span>}
            </span>
          )}
        </button>
      ))}
      <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex justify-between rounded-lg border bg-white/90 px-3 py-2 text-[10px] text-muted-foreground">
        <span>가상 장소 · 위치도 예시입니다</span>
        <span>실제 지도는 연결 후 표시</span>
      </div>
    </div>
  );
}
