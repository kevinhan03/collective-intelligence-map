import fs from "node:fs/promises";
import path from "node:path";
const keys = [
  "SUPABASE_SECRET_KEY",
  "GOOGLE_PLACES_API_KEY",
  "KAKAO_LOCAL_API_KEY",
  "PROVIDER_SIGNING_SECRET",
  "SUPABASE_DB_URL",
];
const contents = await fs.readFile(".env.local", "utf8").catch(() => "");
const secrets = contents
  .split("\n")
  .map((l) => l.split(/=(.*)/s))
  .filter(([k, v]) => keys.includes(k) && v?.length > 10)
  .map(([k, v]) => [k, v.replace(/^['"]|['"]$/g, "")]);
async function walk(p) {
  const result = [];
  for (const e of await fs.readdir(p, { withFileTypes: true })) {
    const file = path.join(p, e.name);
    if (e.isDirectory()) result.push(...(await walk(file)));
    else result.push(file);
  }
  return result;
}
for (const file of await walk(".next/static")) {
  const data = await fs.readFile(file, "utf8");
  for (const [key, value] of secrets) {
    if (data.includes(value))
      throw new Error(`Server secret ${key} found in client bundle`);
  }
}
console.log(
  `PASS: ${secrets.length} configured server secrets absent from client bundles`,
);
