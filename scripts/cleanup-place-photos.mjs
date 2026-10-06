import { createClient } from "@supabase/supabase-js";
if (process.argv.includes("--local")) process.loadEnvFile(".env.test.local");
else process.loadEnvFile(".env.local");
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const expired = await client.rpc("expire_photo_uploads");
if (expired.error) throw new Error(`Expire failed: ${expired.error.code}`);
let cleaned = 0;
while (true) {
  const { data, error } = await client
    .from("place_photos")
    .select("id,cleanup_paths")
    .neq("cleanup_paths", "{}")
    .limit(100);
  if (error) throw new Error(`Read failed: ${error.code}`);
  if (!data.length) break;
  let failed = false;
  for (const row of data) {
    const paths = [...new Set(row.cleanup_paths)];
    const removed = await client.storage.from("place-photos").remove(paths);
    if (removed.error) {
      console.error("photo_cleanup_pending", { photoId: row.id });
      failed = true;
      continue;
    }
    const ack = await client.rpc("ack_photo_cleanup", {
      p_id: row.id,
      p_paths: paths,
    });
    if (ack.error) {
      console.error("photo_cleanup_ack_pending", { photoId: row.id });
      failed = true;
    } else cleaned++;
  }
  if (failed) process.exitCode = 1;
  if (failed) break;
}
console.log(JSON.stringify({ expired: expired.data.length, cleaned }));
