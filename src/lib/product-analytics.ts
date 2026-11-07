"use client";

import type { PostHog } from "posthog-js";
import type { clarity as Clarity } from "clarity-js";
import {
  publicEventProperties,
  sanitizedSdkProperties,
} from "./analytics-properties";
import { canRecordPage, publicTelemetryUrl } from "./telemetry-policy";

type Properties = Record<string, string>;
const allowedEvents = new Set([
  "$pageview",
  "$autocapture",
  "community_view_changed",
  "community_info_opened",
  "place_search_started",
  "place_search_suggestion_selected",
  "place_preview_opened",
  "place_detail_opened",
  "place_sort_changed",
  "place_saved",
  "place_unsaved",
  "map_saved",
  "map_unsaved",
  "proposal_completed",
]);
let posthog: PostHog | undefined;
let clarity: typeof Clarity | undefined;
let loading: Promise<void> | undefined;
let lastPage: string | undefined;
let transitioning = false;
let clickContext: { url: string | null } | undefined;
const queued: {
  event: string;
  properties: Properties;
  url: string;
  at: number;
}[] = [];
let proposalCompletion: { mapId: string; url: string; at: number } | undefined;

// Called only after a successful public-map proposal response. Pending place
// IDs and proposal text stay private; emit on the matching public destination.
export function queueProposalCompleted(mapId: string, slug: string) {
  if (
    typeof window === "undefined" ||
    !publicEventProperties({ map_id: mapId }).map_id
  )
    return;
  const path = window.location.pathname.replace(/^\/(ko|en)(?=\/|$)/, "");
  if (path !== `/maps/${slug}/submit`) return;
  const locale = window.location.pathname.match(/^\/(ko|en)(?=\/)/)?.[0] ?? "";
  proposalCompletion = {
    mapId,
    url: new URL(`${locale}/maps/${slug}`, window.location.origin).href,
    at: Date.now(),
  };
}

function currentUrl() {
  return typeof window === "undefined" || transitioning
    ? null
    : publicTelemetryUrl(window.location.href);
}

export function beforeAnalyticsNavigation(destination: string) {
  if (typeof window === "undefined") return;
  const target = new URL(destination, window.location.href);
  if (target.href === window.location.href) return;
  transitioning = !publicTelemetryUrl(target.href);
  // Stop before Next renders private content. Restart is deliberate on the
  // next safe, committed page, never from an in-flight SDK import.
  clarity?.stop();
}

// Clarity's built-in history observer restarts recording automatically. Stop
// before it sees a history change so only our public-page guard can restart it.
export function installReplayNavigationGuard() {
  // Snapshot the source page before React's click handlers can navigate. A
  // click on a private page must not become public when it routes back home.
  document.addEventListener(
    "click",
    () => {
      const context = { url: currentUrl() };
      clickContext = context;
      window.setTimeout(() => {
        if (clickContext === context) clickContext = undefined;
      }, 0);
    },
    true,
  );
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    window.history[method] = function (...args) {
      const destination = args[2];
      if (
        destination != null &&
        new URL(String(destination), window.location.href).href !==
          window.location.href
      )
        clarity?.stop();
      return original.apply(this, args);
    };
  }
  window.addEventListener("popstate", () => clarity?.stop());
}

export async function startProductAnalytics() {
  if (!currentUrl()) return;
  loading ??= (async () => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (token && host && !posthog) {
      try {
        const { default: sdk } = await import("posthog-js");
        if (!currentUrl()) {
          loading = undefined;
          return;
        }
        sdk.init(token, {
          api_host: host,
          defaults: "2026-08-30",
          autocapture: {
            dom_event_allowlist: ["click"],
            element_allowlist: ["a", "button"],
            css_selector_ignorelist: [
              ".ph-no-capture",
              ".ph-no-autocapture",
              "[data-ph-no-autocapture]",
              "[data-analytics-private]",
              "form",
              "[contenteditable]",
            ],
            capture_copied_text: false,
          },
          mask_all_element_attributes: true,
          mask_all_text: true,
          rageclick: false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_dead_clicks: false,
          capture_exceptions: false,
          capture_performance: false,
          disable_session_recording: true,
          disable_surveys: true,
          disable_external_dependency_loading: true,
          advanced_disable_feature_flags: true,
          enable_heatmaps: false,
          person_profiles: "never",
          persistence: "sessionStorage",
          save_referrer: false,
          save_campaign_params: false,
          before_send: (event) => {
            const safe = currentUrl();
            if (!event || !safe || !allowedEvents.has(event.event)) return null;
            if (
              event.event === "$autocapture" &&
              event.properties.$event_type !== "click"
            )
              return null;
            const sourceUrl =
              event.event === "$autocapture" ? clickContext?.url : safe;
            if (!sourceUrl) return null;
            event.properties = sanitizedSdkProperties(
              event.properties,
              sourceUrl,
            );
            delete event.$set;
            delete event.$set_once;
            return event;
          },
        });
        posthog = sdk;
      } catch {
        // Analytics must never interrupt browsing (including content blockers).
      }
    }
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (projectId) {
      try {
        const sdk = await import("clarity-js");
        if (!currentUrl()) {
          loading = undefined;
          return;
        }
        clarity = sdk.clarity;
      } catch {
        // Keep the other provider working if replay is unavailable.
      }
    }
  })();
  await loading;
  const url = currentUrl();
  if (!url) return;
  if (lastPage !== url) {
    posthog?.capture("$pageview", { $current_url: url });
    lastPage = url;
  }
  for (const item of queued.splice(0)) {
    if (item.url === url && Date.now() - item.at < 60_000)
      posthog?.capture(item.event, item.properties);
  }
  if (proposalCompletion) {
    const completion = proposalCompletion;
    proposalCompletion = undefined;
    if (completion.url === url && Date.now() - completion.at < 60_000)
      posthog?.capture("proposal_completed", {
        map_id: completion.mapId,
        entry: "proposal",
      });
  }
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (
    clarity &&
    projectId &&
    canRecordPage(window.location.href, document.referrer)
  ) {
    clarity.start({
      projectId,
      // Collector assigned by this project's official /tag installation config.
      upload: "https://b.clarity.ms/collect",
      track: false,
      mask: ["body"],
      fraud: false,
      diagnostics: false,
    });
    clarity.consentv2({ analytics_Storage: "denied", ad_Storage: "denied" });
  }
}

export function commitAnalyticsPage() {
  transitioning = false;
  if (!currentUrl()) {
    clarity?.stop();
    lastPage = undefined;
  }
}

export function captureProductEvent(event: string, properties: Properties) {
  if (!currentUrl()) return;
  const safe = publicEventProperties(properties);
  if (posthog) posthog.capture(event, safe);
  else {
    if (queued.length >= 50) queued.shift();
    queued.push({
      event,
      properties: safe,
      url: currentUrl()!,
      at: Date.now(),
    });
  }
  clarity?.event(event, "");
}
