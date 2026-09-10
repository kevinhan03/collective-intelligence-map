import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
export async function GET(request: NextRequest) {
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    token_hash = url.searchParams.get("token_hash");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  let response = NextResponse.redirect(new URL("/", origin));
  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
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
  if (!ok)
    response = NextResponse.redirect(new URL("/login?error=callback", origin));
  return response;
}
