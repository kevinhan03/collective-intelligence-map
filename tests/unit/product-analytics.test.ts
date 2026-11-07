import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canRecordPage, publicTelemetryUrl } from "@/lib/telemetry-policy";

const listeners: Record<string, () => void> = {};
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
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    addEventListener: vi.fn(),
    setTimeout,
  });
  vi.stubGlobal("document", {
    referrer: "",
    addEventListener: vi.fn((name, handler) => {
      listeners[name] = handler;
    }),
  });
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
    mask_all_element_attributes: true,
    mask_all_text: true,
    disable_session_recording: true,
    person_profiles: "never",
  });
  const event = config.before_send({
    event: "$pageview",
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
  expect(config.before_send({ event: "$pageview", properties: {} })).toBeNull();
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

it("sanitizes auto clicks, drops forms and unknown events and never sends DOM text", async () => {
  const api = await import("@/lib/product-analytics");
  await api.startProductAnalytics();
  const config = mocks.init.mock.calls[0][1];
  expect(config.autocapture).toMatchObject({
    dom_event_allowlist: ["click"],
    element_allowlist: ["a", "button"],
    capture_copied_text: false,
  });
  api.installReplayNavigationGuard();
  listeners.click();
  const result = config.before_send({
    event: "$autocapture",
    properties: {
      $event_type: "click",
      control: "place-detail-open",
      map_id: "11111111-1111-4111-8111-111111111111",
      email: "person@example.com",
      rationale: "secret",
      $el_text: "secret",
      $elements: [
        {
          tag_name: "button",
          nth_child: 1,
          $el_text: "secret",
          attr__href: "/login?code=secret",
          attr__value: "secret",
        },
      ],
    },
  });
  expect(result.properties.$elements).toEqual([
    { tag_name: "button", nth_child: 1 },
  ]);
  expect(result.properties.control).toBe("place-detail-open");
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(
    config.before_send({
      event: "$autocapture",
      properties: { $event_type: "change" },
    }),
  ).toBeNull();
  expect(
    config.before_send({ event: "secret event name", properties: {} }),
  ).toBeNull();
});

it("queues early public events and reports proposal success only on the matching public map", async () => {
  const api = await import("@/lib/product-analytics");
  api.captureProductEvent("place_detail_opened", {
    map_id: "11111111-1111-4111-8111-111111111111",
    query: "secret",
  });
  await api.startProductAnalytics();
  expect(mocks.capture).toHaveBeenCalledWith("place_detail_opened", {
    map_id: "11111111-1111-4111-8111-111111111111",
  });
  window.location.href = "https://example.com/maps/ramen/submit";
  Object.assign(window.location, {
    pathname: "/maps/ramen/submit",
    origin: "https://example.com",
  });
  api.queueProposalCompleted("11111111-1111-4111-8111-111111111111", "ramen");
  expect(mocks.capture).not.toHaveBeenCalledWith(
    "proposal_completed",
    expect.anything(),
  );
  window.location.href = "https://example.com/maps/ramen?proposal=secret";
  api.commitAnalyticsPage();
  await api.startProductAnalytics();
  expect(mocks.capture).toHaveBeenCalledWith("proposal_completed", {
    map_id: "11111111-1111-4111-8111-111111111111",
    entry: "proposal",
  });
  await api.startProductAnalytics();
  expect(
    mocks.capture.mock.calls.filter((call) => call[0] === "proposal_completed"),
  ).toHaveLength(1);
});

it("does not relabel clicks from private pages as public after navigation", async () => {
  const api = await import("@/lib/product-analytics");
  await api.startProductAnalytics();
  api.installReplayNavigationGuard();
  const config = mocks.init.mock.calls[0][1];
  window.location.href = "https://example.com/saved";
  listeners.click();
  window.location.href = "https://example.com/maps/ramen";
  expect(
    config.before_send({
      event: "$autocapture",
      properties: { $event_type: "click" },
    }),
  ).toBeNull();
});

it("keeps a public-to-private navigation click attributed only to its public source", async () => {
  const api = await import("@/lib/product-analytics");
  await api.startProductAnalytics();
  api.installReplayNavigationGuard();
  listeners.click();
  api.beforeAnalyticsNavigation("/saved");
  window.location.href = "https://example.com/saved";
  const beforeSend = mocks.init.mock.calls[0][1].before_send;
  const result = beforeSend({
    event: "$autocapture",
    properties: {
      $event_type: "click",
      control: "login-open",
      $current_url: "https://example.com/saved",
    },
  });
  expect(result.properties.$current_url).toBe("https://example.com/maps/ramen");
  expect(beforeSend({ event: "$pageview", properties: {} })).toBeNull();
});
