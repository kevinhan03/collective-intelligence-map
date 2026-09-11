import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Public RLS only: never forward cookies, sessions or service-role credentials. */
export function publicDb() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
