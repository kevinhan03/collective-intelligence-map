// Only public browsing pages may send usage data. Keep locale variants aligned.
export function publicTelemetryUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const path = url.pathname.replace(/^\/(ko|en)(?=\/|$)/, "") || "/";
    if (!/^\/$|^\/(discover|privacy|terms)\/?$|^\/maps\/[^/]+\/?$/.test(path))
      return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

// Replay cannot rewrite browser URLs; record only clean public URLs, including
// a clean referrer. PostHog and Vercel can still count sanitized page views.
export function canRecordPage(raw: string, referrer = ""): boolean {
  if (publicTelemetryUrl(raw) !== raw) return false;
  if (!referrer) return true;
  try {
    const url = new URL(referrer);
    if (url.search || url.hash) return false;
    return (
      url.origin !== new URL(raw).origin ||
      publicTelemetryUrl(referrer) !== null
    );
  } catch {
    return false;
  }
}
