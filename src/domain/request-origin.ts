/** Compare with configured external origin: Next/Vercel may rewrite the internal request URL. */
export function sameOrigin(
  origin: string | null,
  requestUrl: string,
  siteUrl?: string,
) {
  if (!origin) return false;
  try {
    return origin === new URL(siteUrl || requestUrl).origin;
  } catch {
    return false;
  }
}
