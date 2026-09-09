import Link from "next/link";
export default function Terms() {
  return (
    <main id="main" className="page-wrap max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">이용약관 · 비공개 MVP 초안</h1>
      <p className="text-sm leading-7">
        Collective Map은 장소의 주제 적합성을 함께 추천하고 검증하는 공개
        커뮤니티입니다. 일반 평점이나 영업 여부를 보장하지 않습니다. 방문 전
        장소의 공식 안내를 확인해 주세요.
      </p>
      <p className="text-sm leading-7">
        본인이 작성하거나 공유할 권한이 있는 정보만 제출할 수 있습니다. 외부
        제공자의 검색 결과·사진·리뷰를 무단 복제하지 마세요. 광고성 스팸, 허위
        기여, 개인 정보 공개, 투표 조작은 제한됩니다. 운영자는 커뮤니티 규칙에
        따라 검토·숨김·계정 제한을 할 수 있습니다.
      </p>
      <p className="text-sm leading-7">
        Google 지도와 장소 검색에는{" "}
        <a
          className="underline"
          href="https://maps.google.com/help/terms_maps.html"
        >
          Google Maps 이용약관
        </a>
        , Kakao 지도에는{" "}
        <a
          className="underline"
          href="https://developers.kakao.com/terms/ko/site-terms"
        >
          Kakao 약관
        </a>
        이 적용됩니다.
      </p>
      <p className="rounded border p-4 text-sm text-muted-foreground">
        공개 출시 전 운영 주체·문의 창구·탈퇴 및 이의제기 절차를 확정해야
        합니다. 이 문서는 비공개 개발 검토용입니다.
      </p>
      <Link className="text-sm underline" href="/">
        돌아가기
      </Link>
    </main>
  );
}
