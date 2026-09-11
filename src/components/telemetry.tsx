"use client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Authentication URLs may contain one-time codes. Never send query strings.
export function publicTelemetryUrl(raw: string): string | null {
  const url = new URL(raw);
  if (/^\/(auth|login|admin|settings|u|saved)(\/|$)/.test(url.pathname))
    return null;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function Telemetry() {
  return (
    <>
      <Analytics
        beforeSend={(event) => {
          const url = publicTelemetryUrl(event.url);
          return url ? { ...event, url } : null;
        }}
      />
      <SpeedInsights
        beforeSend={(event) => {
          const url = publicTelemetryUrl(event.url);
          return url ? { ...event, url } : null;
        }}
      />
    </>
  );
}
