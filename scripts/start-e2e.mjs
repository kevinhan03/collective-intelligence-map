import { spawn } from "node:child_process";

// Build and serve the same isolated demo environment. Production builds avoid
// development-server manifest writes while parallel browser tests navigate.
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_TEST_BUILD: "true",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${process.env.PORT ?? "3100"}`,
  PORT: process.env.PORT ?? "3100",
};

let child;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    child?.kill(signal);
  });
}

function run(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], {
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

const buildStatus = await run(["build"]);
if (stopping || buildStatus !== 0) process.exit(buildStatus || 1);
process.exit(await run(["start", "--hostname", "127.0.0.1"]));
