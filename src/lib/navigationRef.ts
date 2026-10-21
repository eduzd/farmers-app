import { createNavigationContainerRef } from "@react-navigation/native";

/** Lets code outside screens (push notification taps) open a screen. */
export const navigationRef = createNavigationContainerRef<any>();

/** Navigate as soon as the navigator is ready (a tap can arrive before it is, on a cold start). */
export function navigateWhenReady(name: string, params?: Record<string, unknown>, tries = 0) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return;
  }
  if (tries < 40) setTimeout(() => navigateWhenReady(name, params, tries + 1), 250);
}
