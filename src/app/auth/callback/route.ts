import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { anonymousVoteCookie, anonymousVoteHash } from "@/server/anonymous-votes";
export async function GET(request: NextRequest) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
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
  }
  if (!ok) {
    response = NextResponse.redirect(new URL("/login?error=callback", origin));
    return response;
  }
  const anonymousToken = request.cookies.get(anonymousVoteCookie)?.value;
  if (anonymousToken) {
    const { error } = await client.rpc("merge_anonymous_votes", {
      p_token_hash: anonymousVoteHash(anonymousToken),
    });
    if (!error) response.cookies.delete(anonymousVoteCookie);
  }
  return response;
}
