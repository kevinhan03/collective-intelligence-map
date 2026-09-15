"use client";

import { useSearchParams } from "next/navigation";

export function ProposalNotice() {
  const params = useSearchParams();
  if (params.get("submitted") !== "1") return null;
  return (
    <p
      role="status"
      className="mx-auto max-w-7xl px-6 py-3 text-sm text-primary"
    >
      제안을 받았어요. 지도에서 장소를 확인해 주세요. 검토 대기 장소는 승인 후
      일반 목록에 표시됩니다.
    </p>
  );
}
