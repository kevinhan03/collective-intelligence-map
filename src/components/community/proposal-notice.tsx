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
      제안을 받았어요. 운영자가 승인하면 지도에 표시됩니다.
    </p>
  );
}
