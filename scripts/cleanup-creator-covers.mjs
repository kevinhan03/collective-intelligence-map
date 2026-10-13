import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("서버 Supabase URL과 비밀키가 필요합니다.");
const client = createClient(url, key, { auth: { persistSession: false } });
const jobs = await client.rpc("creator_cover_jobs");
if (jobs.error) throw new Error(jobs.error.code);
let cleaned = 0;
for (const path of jobs.data ?? []) {
  const removed = await client.storage
    .from("creator-map-covers")
    .remove([path]);
  if (removed.error) continue;
  const ack = await client.rpc("creator_cover_cleaned", { target: path });
  if (!ack.error) cleaned++;
}
console.log(`커버 정리: ${cleaned}/${jobs.data?.length ?? 0}`);
