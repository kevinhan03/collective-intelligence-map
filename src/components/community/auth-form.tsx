"use client";
import { useState } from "react";
import { browserDb } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { loginReturnCookie, safeReturnPath } from "@/domain/login-return";
import { useI18n } from "@/i18n/client";
export function AuthForm({
  enabled,
  next,
}: {
  enabled: boolean;
  next: string;
}) {
  const { t } = useI18n();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function loginWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const client = browserDb();
      document.cookie = `${loginReturnCookie}=${encodeURIComponent(safeReturnPath(next))}; Path=/; Max-Age=600; SameSite=Lax`;
      const redirectTo = `${window.location.origin}/auth/callback`;
      const result = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (result.error) throw result.error;
    } catch {
      setError(t("login.couldnTStartGoogleSign"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      {!enabled && (
        <p className="rounded-lg bg-secondary p-4 text-sm leading-6">
          {t("login.thisIsAPreviewGoogle")}
        </p>
      )}
      <Button
        className="h-14 w-full bg-white text-base text-black hover:bg-gray-100"
        disabled={!enabled || busy}
        onClick={loginWithGoogle}
      >
        {t("login.continueWithGoogle")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
