"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during server rendering and while React hydrates, true afterwards (no effect, no mismatch).
 *
 * `App` sits inside a Suspense boundary, so React may hydrate it after the store's own effect has already
 * flipped `ready`. Gating on this keeps the first client render identical to the prerendered loading screen.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
