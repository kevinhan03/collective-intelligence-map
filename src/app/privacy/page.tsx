import Link from "next/link";
export default function Privacy() {
  return (
    <main id="main" className="page-wrap max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">개인정보 처리방침 · MVP 초안</h1>
      <p className="text-sm leading-7">
        로그인 이메일과 인증 정보는 Supabase Auth로 처리합니다. 공개 프로필
        이름·소개·이미지, 제안·댓글 등 공개 기여와 개인 저장·팔로우 관계를
        저장합니다. 저장 목록은 본인만 조회할 수 있습니다.
      </p>
      <p className="text-sm leading-7">
        신규 장소 외부 검색 시 검색어와 도시 범위를 Google에 전달합니다. API
        응답 원문·인증 키를 사용량 로그에 보관하지 않습니다. API 사용 기록에는
        작업 종류·시간·결과·비용 추정과 한도 적용에 필요한 사용자 식별자가
        포함됩니다.
      </p>
      <p className="text-sm leading-7">
        Google 서비스 이용 시{" "}
        <a className="underline" href="https://policies.google.com/privacy">
          Google 개인정보처리방침
        </a>
        을 확인해 주세요. 지도 공급자가 브라우저의 IP 등 연결 정보를 수신할 수
        있습니다.
      </p>
      <p className="rounded border p-4 text-sm text-muted-foreground">
        공개 출시 전 처리 주체·연락처·보유 기간·국외 이전·열람 및 삭제 요청
        절차를 운영 환경에 맞게 확정해야 합니다.
      </p>
      <Link href="/" className="text-sm underline">
        돌아가기
      </Link>
    </main>
  );
}
