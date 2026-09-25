"use client";
import { useState } from "react";
import { browserDb } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { loginReturnCookie, safeReturnPath } from "@/domain/login-return";
export function AuthForm({ enabled, next }: { enabled: boolean; next: string }) {
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
      setError(
        "Google 로그인을 시작하지 못했습니다. 연결 설정을 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      {!enabled && (
        <p className="rounded-lg bg-secondary p-4 text-sm leading-6">
          현재는 미리보기입니다. Supabase 연결 후 Google 로그인을 사용할 수
          있습니다.
        </p>
      )}
      <Button
        variant="outline"
        className="h-14 w-full text-base"
        disabled={!enabled || busy}
        onClick={loginWithGoogle}
      >
        Google로 계속하기
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
