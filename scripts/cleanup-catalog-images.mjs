import { createClient } from "@supabase/supabase-js";
const local = process.argv.includes("--local");
process.loadEnvFile(local ? ".env.test.local" : ".env.local");
if (
  local &&
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  )
)
  throw new Error("Local cleanup requires local Supabase.");
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let cleaned = 0;
while (true) {
  const jobs = await client.rpc("catalog_image_cleanup", {
    payload: { action: "claim" },
  });
  if (jobs.error) throw new Error(`Cleanup query failed: ${jobs.error.code}`);
  if (!jobs.data.length) break;
  let failed = false;
  for (const job of jobs.data) {
    const removed = await client.storage
      .from("catalog-images")
      .remove([job.path]);
    if (removed.error) {
      failed = true;
      continue;
    }
    const ack = await client.rpc("catalog_image_cleanup", {
      payload: { action: "ack", id: job.id },
    });
    if (ack.error) failed = true;
    else cleaned++;
  }
  if (failed) {
    process.exitCode = 1;
    break;
  }
}
console.log(
  JSON.stringify({ cleaned, pendingFailures: process.exitCode === 1 }),
);
