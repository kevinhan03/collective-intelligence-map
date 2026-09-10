import { sameOrigin } from "@/domain/request-origin";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
export async function POST(request: Request) {
  if (
    !sameOrigin(
      request.headers.get("origin"),
      request.url,
      process.env.NEXT_PUBLIC_SITE_URL,
    )
  )
    return new Response("Forbidden", { status: 403 });
  const client = await db();
  await client.auth.signOut();
  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_SITE_URL || request.url),
    303,
  );
}
