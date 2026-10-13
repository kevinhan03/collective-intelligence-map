import Link from "next/link";
import { MapPin } from "lucide-react";
import { ProfileCardImage } from "./profile-card-image";
export function RecommendationCollectionCard({
  handle,
  count,
  error,
}: {
  handle: string;
  count: number;
  error?: string;
}) {
  return (
    <Link
      href={`/u/${encodeURIComponent(handle)}/recommendations`}
      className="profile-map profile-map-featured profile-recommendations-card"
      aria-label="내가 추천한 장소"
    >
      <ProfileCardImage theme="food" />
      <div className="profile-map-copy">
        <h3>내가 추천한 장소</h3>
        <p>
          <MapPin size={12} aria-hidden="true" />
          {error
            ? "다시 열어 확인해 주세요"
            : `공개 장소 ${count}곳 · 목록과 지도로 보기`}
        </p>
      </div>
    </Link>
  );
}
