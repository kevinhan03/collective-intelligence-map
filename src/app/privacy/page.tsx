import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "개인정보처리방침" };

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
      <p className="text-sm leading-7">
        공개 화면의 방문 통계와 이용 흐름을 파악하기 위해 Vercel Analytics,
        PostHog, Microsoft Clarity를 사용합니다. 페이지 조회, 기기 정보, 공개
        화면의 버튼·링크 클릭, 지도·목록 전환, 장소 상세 열기와 저장·제안 완료
        등 이용 이벤트를 분석합니다. 공개 지도·장소 식별자를 함께 사용하며
        장소명과 제안 내용은 전송하지 않습니다. PostHog는 브라우저 세션 식별자를
        사용하며 계정 정보와 연결하지 않습니다. Clarity는 쿠키 저장 없이
        클릭·스크롤 및 마스킹한 화면을 기록합니다. 로그인·관리·개인 저장 등
        비공개 화면은 수집하지 않으며, 검색어·이메일·인증 코드·입력 내용은 분석
        이벤트에 첨부하지 않습니다.
        <a className="underline" href="https://vercel.com/legal/privacy-policy">
          Vercel
        </a>
        ,{" "}
        <a className="underline" href="https://posthog.com/privacy">
          PostHog
        </a>
        ,{" "}
        <a
          className="underline"
          href="https://privacy.microsoft.com/privacystatement"
        >
          Microsoft
        </a>
        의 개인정보 처리 안내를 확인할 수 있습니다.
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
