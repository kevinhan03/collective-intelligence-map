import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canRecordPage, publicTelemetryUrl } from "@/lib/telemetry-policy";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  consentv2: vi.fn(),
  event: vi.fn(),
}));
vi.mock("posthog-js", () => ({
  default: { init: mocks.init, capture: mocks.capture },
}));
vi.mock("clarity-js", () => ({ clarity: mocks }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "testproject");
  vi.stubGlobal("window", {
    location: { href: "https://example.com/maps/ramen" },
  });
  vi.stubGlobal("document", { referrer: "" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("allows public locale routes and denies private, nested and malformed routes", () => {
  for (const path of ["/en", "/ko/maps/ramen", "/discover"])
    expect(publicTelemetryUrl(`https://example.com${path}`)).not.toBeNull();
  for (const path of [
    "/en/login",
    "/ko/saved",
    "/studio",
    "/my-proposals",
    "/maps/ramen/submit",
    "/api/places",
  ])
    expect(publicTelemetryUrl(`https://example.com${path}`)).toBeNull();
  expect(publicTelemetryUrl("invalid")).toBeNull();
  expect(canRecordPage("https://example.com/?code=secret")).toBe(false);
  expect(
    canRecordPage("https://example.com/", "https://example.com/auth/callback"),
  ).toBe(false);
  expect(
    canRecordPage("https://example.com/", "https://threads.com/public-post"),
  ).toBe(true);
});

it("initializes once, sends one pageview and filters SDK URLs at send time", async () => {
  const api = await import("@/lib/product-analytics");
  await Promise.all([api.startProductAnalytics(), api.startProductAnalytics()]);
  expect(mocks.init).toHaveBeenCalledTimes(1);
  expect(mocks.capture).toHaveBeenCalledTimes(1);
  const config = mocks.init.mock.calls[0][1];
  expect(config).toMatchObject({
    autocapture: false,
    disable_session_recording: true,
    person_profiles: "never",
  });
  const event = config.before_send({
    properties: {
      $initial_current_url: "https://example.com/?secret",
      $referrer: "private",
      entry: "list",
    },
  });
  expect(event.properties).toEqual({
    entry: "list",
    $current_url: "https://example.com/maps/ramen",
    $pathname: "/maps/ramen",
  });
  api.beforeAnalyticsNavigation("/login");
  expect(mocks.stop).toHaveBeenCalled();
  expect(config.before_send({ properties: {} })).toBeNull();
  api.captureProductEvent("place_detail_opened", {});
  expect(mocks.capture).toHaveBeenCalledTimes(1);
});

it("does not initialize on private pages or record query URLs", async () => {
  window.location.href = "https://example.com/login?code=secret";
  const api = await import("@/lib/product-analytics");
  await api.startProductAnalytics();
  expect(mocks.init).not.toHaveBeenCalled();
  window.location.href = "https://example.com/maps/ramen?query=secret";
  api.commitAnalyticsPage();
  await api.startProductAnalytics();
  expect(mocks.capture).toHaveBeenCalledWith("$pageview", {
    $current_url: "https://example.com/maps/ramen",
  });
  expect(mocks.start).not.toHaveBeenCalled();
});

it("stops replay before native history changes and prevents private imports racing navigation", async () => {
  const handler = vi.fn();
  const pushState = vi.fn(() => expect(mocks.stop).toHaveBeenCalled());
  Object.assign(window, {
    history: { pushState, replaceState: vi.fn() },
    addEventListener: handler,
  });
  const api = await import("@/lib/product-analytics");
  api.installReplayNavigationGuard();
  await api.startProductAnalytics();
  window.history.pushState(null, "", "/login");
  expect(pushState).toHaveBeenCalled();
  const pending = api.startProductAnalytics();
  api.beforeAnalyticsNavigation("/saved");
  window.location.href = "https://example.com/saved";
  await pending;
  expect(mocks.start).toHaveBeenCalledTimes(1);
});
