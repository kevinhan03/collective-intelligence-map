import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Forbidden", { status: 403 });
  const client = await db();
  await client.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
