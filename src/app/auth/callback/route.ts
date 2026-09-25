import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { anonymousVoteCookie, anonymousVoteHash } from "@/server/anonymous-votes";
import { loginReturnCookie, safeReturnPath } from "@/domain/login-return";
export async function GET(request: NextRequest) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const returnCookie = request.cookies.get(loginReturnCookie)?.value;
  let next = "/";
  try {
    next = safeReturnPath(returnCookie ? decodeURIComponent(returnCookie) : null);
  } catch {
    next = "/";
  }
  let response = NextResponse.redirect(new URL(next, origin));
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
  }
  if (!ok) {
    const login = new URL("/login", origin);
    login.searchParams.set("error", "callback");
    if (next !== "/") login.searchParams.set("next", next);
    response = NextResponse.redirect(login);
    response.cookies.delete(loginReturnCookie);
    return response;
  }
  response.cookies.delete(loginReturnCookie);
  const anonymousToken = request.cookies.get(anonymousVoteCookie)?.value;
  if (anonymousToken) {
    const { error } = await client.rpc("merge_anonymous_votes", {
      p_token_hash: anonymousVoteHash(anonymousToken),
    });
    if (!error) response.cookies.delete(anonymousVoteCookie);
  }
  return response;
}
