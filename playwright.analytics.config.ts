import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results-analytics",
  testDir: "./tests/analytics",
  testMatch: "analytics.spec.ts",
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "https://ting.test", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
