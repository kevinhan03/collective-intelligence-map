"use client";
import { useEffect } from "react";
/** Also mounted outside the editor so a sign-out/account switch clears tab drafts. */
export function CatalogSessionGuard({ userId }: { userId: string | null }) {
  useEffect(() => {
    try {
      const keep = userId ? `ting:catalog-draft:${userId}` : null;
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith("ting:catalog-draft:") && key !== keep)
          sessionStorage.removeItem(key);
    } catch {
      /* The editor explains when persistence is unavailable. */
    }
  }, [userId]);
  return null;
}
