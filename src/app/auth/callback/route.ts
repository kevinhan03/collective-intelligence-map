import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    token_hash = url.searchParams.get("token_hash");
  const client = await db();
  let ok = false;
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (token_hash) {
    const { error } = await client.auth.verifyOtp({
      token_hash,
      type: "email",
    });
    ok = !error;
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  return NextResponse.redirect(
    new URL(ok ? "/settings/profile" : "/login?error=callback", origin),
  );
}
