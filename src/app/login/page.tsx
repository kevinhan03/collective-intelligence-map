import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/community/auth-form";
import { configured } from "@/lib/supabase/server";
import { getViewer } from "@/server/queries";
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
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getViewer()) redirect("/settings/profile");
  const { error } = await searchParams;
  return (
    <main id="main" className="page-wrap flex justify-center py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-6">
          <p className="kicker mb-3">Your perspective matters</p>
          <CardTitle className="text-2xl">나의 발견을, 함께.</CardTitle>
          <CardDescription className="leading-6">
            좋아하는 지도를 팔로우하고 장소를 저장하세요.
            <br />
            초기 장소 제안과 검증은 초대 기여자와 함께합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              로그인 링크가 만료되었거나 올바르지 않습니다. 새 링크를 요청해
              주세요.
            </p>
          )}
          <AuthForm
            enabled={configured()}
            googleEnabled={process.env.GOOGLE_AUTH_ENABLED === "true"}
          />
          <p className="mt-6 text-xs leading-6 text-muted-foreground">
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
