import "server-only";
import { createClient } from "@supabase/supabase-js";
export function serviceDb() {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new Error("외부 검색 서버 설정이 필요합니다.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
