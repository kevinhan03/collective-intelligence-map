"use client";
import type { Database } from "@/types/database";
import { createBrowserClient } from "@supabase/ssr";
export function browserDb() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
