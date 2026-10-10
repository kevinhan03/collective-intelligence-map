import { useSyncExternalStore } from "react";
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const originalPush = history.pushState.bind(history);
history.pushState = (...args) => {
  originalPush(...args);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
export function useSearchParams() {
  return new URLSearchParams(
    useSyncExternalStore(subscribe, () => location.search),
  );
}
export function usePathname() {
  return location.pathname;
}
export function useRouter() {
  return {
    push: (url: string) => history.pushState(null, "", url),
    replace: (url: string) => history.replaceState(null, "", url),
    refresh: () => {
      window.dispatchEvent(new Event("workflow-refresh"));
    },
  };
}
