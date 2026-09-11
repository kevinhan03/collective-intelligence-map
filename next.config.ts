import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_TEST_BUILD === "true" ? ".next-e2e" : ".next",
};

export default nextConfig;
