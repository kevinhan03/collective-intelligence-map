"use client";

import type { PostHog } from "posthog-js";
import type { clarity as Clarity } from "clarity-js";
import { canRecordPage, publicTelemetryUrl } from "./telemetry-policy";

type Properties = Record<string, string>;
let posthog: PostHog | undefined;
let clarity: typeof Clarity | undefined;
let loading: Promise<void> | undefined;
let lastPage: string | undefined;
let transitioning = false;

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
          autocapture: false,
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
            if (!event || !safe) return null;
            // Strip SDK URL/entry/referrer properties as well as application
            // query strings. No identity or form values are registered.
            for (const key of Object.keys(event.properties)) {
              if (/url|referr|pathname|initial|utm_|gclid|fbclid/i.test(key))
                delete event.properties[key];
            }
            event.properties.$current_url = safe;
            event.properties.$pathname = new URL(safe).pathname;
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
  posthog?.capture(event, properties);
  clarity?.event(event, "");
}
