import {
  beforeAnalyticsNavigation,
  installReplayNavigationGuard,
} from "@/lib/product-analytics";

installReplayNavigationGuard();

export function onRouterTransitionStart(url: string) {
  beforeAnalyticsNavigation(url);
}
