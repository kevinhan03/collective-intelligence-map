export const loginReturnCookie = "cm_login_next";

export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const base = "https://collective-map.invalid";
    const target = new URL(value, base);
    if (target.origin !== base) return "/";
    if (target.pathname === "/login" || target.pathname.startsWith("/auth/")) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}

export function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(safeReturnPath(next))}`;
}
