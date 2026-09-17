import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const env = { ...process.env };
const socket = path.join(os.homedir(), ".colima/cim/docker.sock");
if (!env.DOCKER_HOST && fs.existsSync(socket))
  env.DOCKER_HOST = `unix://${socket}`;
const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
  env,
  encoding: "utf8",
});
const s = JSON.parse(raw);
if (!["localhost", "127.0.0.1"].includes(new URL(s.API_URL).hostname))
  throw new Error("Expected local Supabase only");
fs.mkdirSync(".local", { recursive: true });
fs.writeFileSync(".local/supabase-status.json", raw, { mode: 0o600 });
const values = {
  NEXT_PUBLIC_SUPABASE_URL: s.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY || s.ANON_KEY,
  SUPABASE_SECRET_KEY: s.SECRET_KEY || s.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  PROVIDER_SIGNING_SECRET: crypto.randomBytes(48).toString("base64url"),
  GOOGLE_PLACES_ENABLED: "false",
  KAKAO_PLACES_ENABLED: "false",
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: "",
  NEXT_PUBLIC_KAKAO_MAPS_KEY: "",
};
fs.writeFileSync(
  ".env.test.local",
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
console.log(
  "Local environment prepared. Start with npm run dev:local. Remote .env.local was not modified.",
);
