"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function AuthForm({
  enabled,
  googleEnabled = false,
}: {
  enabled: boolean;
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(oauth = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = browserDb();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const result = oauth
        ? await client.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo },
          })
        : await client.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectTo },
          });
      if (result.error) throw result.error;
      if (!oauth)
        setMessage("로그인 링크를 보냈습니다. 이메일을 확인해 주세요.");
    } catch {
      setError(
        "로그인을 시작하지 못했습니다. 주소와 연결 설정을 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verifyCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await browserDb().auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      router.push("/settings/profile");
      router.refresh();
    } catch {
      setError("인증 코드가 올바르지 않거나 만료되었습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      {!enabled && (
        <p className="rounded-lg bg-secondary p-4 text-sm leading-6">
          현재는 미리보기입니다. Supabase 연결 후 이메일·Google 로그인을 사용할
          수 있습니다.
        </p>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void login();
        }}
      >
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={!enabled}
        />
        <Button className="w-full" disabled={!enabled || busy}>
          이메일로 로그인 링크 받기
        </Button>
      </form>
      <form
        className="space-y-3 border-t pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          void verifyCode();
        }}
      >
        <Label htmlFor="code">이메일 인증 코드</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="코드가 표시된 경우 입력"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!enabled || busy || !email}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!enabled || busy || !email || !code.trim()}
          >
            확인
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          링크가 열리지 않는 메일 앱에서는 이메일에 표시된 인증 코드를 사용할 수
          있습니다.
        </p>
      </form>
      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            또는
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={!enabled || busy}
            onClick={() => login(true)}
          >
            Google로 계속하기
          </Button>
        </>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
