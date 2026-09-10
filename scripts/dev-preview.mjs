import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"],
  {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
    },
    stdio: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
