import { CARD_BY_ID } from "@/data/cards";

/**
 * URL state for `/`:  ?v=<view>&id=<card id>
 *   v  = which screen (no param: Landing when signed out, ID path when signed in)
 *   id = the ID whose detail sheet is open
 * Pure helpers only (no React, no window), so parsing and guards are easy to reason about.
 */

export type View =
  | "tree"
  | "browse"
  | "guide"
  | "progress"
  | "settings"
  | "auth"
  | "edit";
export type Screen = "landing" | View;

const VIEWS: readonly string[] = [
  "tree",
  "browse",
  "guide",
  "progress",
  "settings",
  "auth",
  "edit",
];

export interface RawRoute {
  /** Recognised `v`, else null. */
  view: View | null;
  /** Recognised card id, else null. */
  id: string | null;
  /** The URL carried a `v` or `id` value we do not know. */
  dirty: boolean;
}

/** Reads and validates the query string. Unknown values are dropped and flagged as `dirty`. */
export function readRoute(search: { get(name: string): string | null }): RawRoute {
  const v = search.get("v");
  const id = search.get("id");
  const view = v !== null && VIEWS.includes(v) ? (v as View) : null;
  const validId = id !== null && Object.prototype.hasOwnProperty.call(CARD_BY_ID, id) ? id : null;
  return { view, id: validId, dirty: (v !== null && view === null) || (id !== null && validId === null) };
}

export interface Route {
  /** The screen to show (guards applied). */
  screen: Screen;
  /** The `v` to keep when building URLs (guards applied), null when absent. */
  view: View | null;
  /** The ID whose sheet is open, or null. */
  id: string | null;
  /** The URL as typed needs replacing with `canonical` (unknown values or a guarded view). */
  fixed: boolean;
  canonical: string;
}

/** Applies the guards: auth is pointless when signed in. (Guests see a reduced Progress with suggestions.) */
export function resolveRoute(raw: RawRoute, signedIn: boolean): Route {
  let view = raw.view;
  let fixed = raw.dirty;
  if (view === "auth" && signedIn) {
    view = "tree";
    fixed = true;
  }
  // An ID with no view opens the tree with that sheet (skipping the landing); signed-in users never see the landing.
  const screen: Screen = view ?? (raw.id || signedIn ? "tree" : "landing");
  return { screen, view, id: raw.id, fixed, canonical: buildUrl(view, raw.id) };
}

export function buildUrl(view: View | null, id: string | null): string {
  const params = new URLSearchParams();
  if (view) params.set("v", view);
  if (id) params.set("id", id);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}
