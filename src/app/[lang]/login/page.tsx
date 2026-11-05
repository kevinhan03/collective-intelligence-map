import Link from "@/i18n/link";
import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/server";
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
import { getTranslator } from "@/i18n/server";
import { rich } from "@/i18n/rich";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const t = await getTranslator();
  const { error, next } = await searchParams;
  if (await getViewer())
    redirect(
      await localizedPath(next ? safeReturnPath(next) : "/settings/profile"),
    );
  return (
    <main
      id="main"
      className="page-wrap flex min-h-[calc(100dvh-96px)] items-center justify-center py-10 sm:py-16"
    >
      <Card className="w-full max-w-md [--card-spacing:--spacing(8)] sm:[--card-spacing:--spacing(12)]">
        <CardHeader className="gap-4 pb-8 sm:gap-6 sm:pb-12">
          <p className="kicker mb-2">Login</p>
          <CardTitle className="text-3xl leading-tight break-keep sm:text-5xl">
            {t("login.signInSignUp")}
          </CardTitle>
          <CardDescription className="text-base leading-7 break-keep sm:leading-8">
            {t("login.saveTheMapsYouLove")}
            <br />
            {t("login.earlyPlaceSuggestionsAndReviews")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {t("login.couldnTFinishSigningIn")}
            </p>
          )}
          <AuthForm
            enabled={configured() && process.env.GOOGLE_AUTH_ENABLED === "true"}
            next={await localizedPath(next ? safeReturnPath(next) : "/")}
          />
          <p className="mt-8 text-xs leading-6 text-muted-foreground sm:mt-16">
            {rich(t("login.consent"), {
              terms: (chunk) => (
                <Link href="/terms" className="underline">
                  {chunk}
                </Link>
              ),
              privacy: (chunk) => (
                <Link href="/privacy" className="underline">
                  {chunk}
                </Link>
              ),
            })}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
