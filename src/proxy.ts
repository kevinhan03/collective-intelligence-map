import type { Database } from "@/types/database";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  hasLocale,
  localeCookie,
  localePrefix,
  localizePath,
  stripLocale,
} from "@/i18n/config";

// Korean pages keep unprefixed URLs and are served from /ko internally;
// /en pages carry their prefix, and a saved English choice redirects there.
// Files and non-page routes are left alone.
function localeRewrite(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/^\/(?:api|auth|go|_next|__)(?:\/|$)|\.[\w]+$/.test(pathname))
    return null;
  const prefix = localePrefix(pathname);
  if (prefix && prefix !== defaultLocale) return null;
  const url = request.nextUrl.clone();
  const saved = request.cookies.get(localeCookie)?.value;
  if (!prefix && saved && saved !== defaultLocale && hasLocale(saved)) {
    url.pathname = localizePath(pathname, saved);
    return NextResponse.redirect(url);
  }
  if (prefix === defaultLocale) {
    url.pathname = stripLocale(pathname);
    return NextResponse.redirect(url, 308);
  }
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return url;
}

export async function proxy(request: NextRequest) {
  const rewrite = localeRewrite(request);
  if (rewrite instanceof NextResponse) return rewrite;
  const pass = () =>
    rewrite
      ? NextResponse.rewrite(rewrite, { request })
      : NextResponse.next({ request });
  let response = pass();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return response;
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!hasAuthCookie) return response;
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = pass();
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
