import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/community/auth-form";
import { configured } from "@/lib/supabase/server";
import { getViewer } from "@/server/queries";
import { safeReturnPath } from "@/domain/login-return";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  if (await getViewer()) redirect(next ? safeReturnPath(next) : "/settings/profile");
  return (
    <main
      id="main"
      className="page-wrap flex min-h-[calc(100dvh-96px)] items-center justify-center py-16"
    >
      <Card className="w-full max-w-md [--card-spacing:--spacing(12)]">
        <CardHeader className="gap-6 pb-12">
          <p className="kicker mb-2">Your perspective matters</p>
          <CardTitle className="text-5xl leading-tight">
            나의 발견을, 함께.
          </CardTitle>
          <CardDescription className="text-base leading-8">
            좋아하는 지도를 팔로우하고 장소를 저장하세요.
            <br />
            초기 장소 제안과 검증은 초대 기여자와 함께합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.
            </p>
          )}
          <AuthForm
            enabled={configured() && process.env.GOOGLE_AUTH_ENABLED === "true"}
            next={next ? safeReturnPath(next) : "/"}
          />
          <p className="mt-16 text-xs leading-6 text-muted-foreground">
            계속하면{" "}
            <Link href="/terms" className="underline">
              이용약관
            </Link>
            과{" "}
            <Link href="/privacy" className="underline">
              개인정보 처리방침
            </Link>
            을 확인한 것으로 간주합니다.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
