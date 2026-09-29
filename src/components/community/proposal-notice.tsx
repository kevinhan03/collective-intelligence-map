import Link from "next/link";

export function ProposalNotice({
  status,
  created,
  mapSlug,
  id,
}: {
  status: string;
  created: boolean;
  mapSlug: string;
  id: string;
}) {
  const message = !created
    ? status === "pending"
      ? "이미 검토 대기 중인 장소입니다. 새 제안으로 중복 접수되지 않았어요."
      : "이미 공개된 장소입니다. 새 제안으로 중복 접수되지 않았어요."
    : status === "approved" || status === "disputed"
      ? "장소가 공개되었습니다. 지도에서 확인해 주세요."
      : "제안을 받았어요. 검토 대기 장소로 지도에 표시됩니다.";
  return (
    <p
      role="status"
      className="mx-auto max-w-7xl px-6 py-3 text-sm text-primary"
    >
      {message}{" "}
      <Link className="underline" href={`/maps/${mapSlug}?proposal=${encodeURIComponent(id)}`}>
        장소 보기
      </Link>{" "}
      · <Link className="underline" href="/my-proposals">내 제안</Link>
    </p>
  );
}
