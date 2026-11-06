"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  commitAnalyticsPage,
  startProductAnalytics,
} from "@/lib/product-analytics";
import { publicTelemetryUrl } from "@/lib/telemetry-policy";
export { publicTelemetryUrl } from "@/lib/telemetry-policy";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function Telemetry() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    commitAnalyticsPage();
    const timer = window.setTimeout(() => {
      void startProductAnalytics();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);
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
