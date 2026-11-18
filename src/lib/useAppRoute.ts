"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { buildUrl, readRoute, resolveRoute, type Route, type View } from "./route";

/**
 * The URL is the source of truth for the current screen and the open detail sheet.
 *
 * Reading uses `useSearchParams` (the caller must sit inside a <Suspense> boundary).
 * Writing uses the native History API: Next.js syncs `pushState` / `replaceState` into `useSearchParams`
 * (see "Native History API" in the docs), and it avoids a server round trip for what is purely client state.
 *
 * History model:
 *   change view            push        (Back returns to the previous view)
 *   open a sheet           push        (Back closes it)
 *   jump ID -> ID in sheet replace     (Back closes the sheet in one step)
 *   close the sheet        back() if this session pushed it, else replace without `id`
 *   login / logout / save  replace     (Back never returns to a form or a signed-in screen)
 */
export function useAppRoute(signedIn: boolean, ready: boolean) {
  const searchParams = useSearchParams();
  const route = useMemo(() => resolveRoute(readRoute(searchParams), signedIn), [searchParams, signedIn]);

  // Callbacks read the latest route through a ref so they keep a stable identity (they feed memoised tree nodes).
  const latest = useRef<Route>(route);
  useEffect(() => {
    latest.current = route;
  });

  // Entries this session pushed that "back" can safely pop: "sheet", "auth", "edit".
  const pushed = useRef(new Set<string>());
  useEffect(() => {
    if (!route.id) pushed.current.delete("sheet");
    if (route.screen !== "auth") pushed.current.delete("auth");
    if (route.screen !== "edit") pushed.current.delete("edit");
  }, [route.id, route.screen]);

  // Typed a URL we do not understand (unknown id/view, progress while signed out, ...): tidy it, without a history entry.
  // Waits for the store so a signed-in user's deep link is not "fixed" before the account has loaded.
  // Re-reads the live URL instead of the render-time snapshot: a handler may have called history.replaceState
  // (e.g. logout -> "/") in the same tick, and `searchParams` can lag behind it by a render.
  useEffect(() => {
    if (!ready || !route.fixed) return;
    const live = resolveRoute(readRoute(new URLSearchParams(window.location.search)), signedIn);
    if (live.fixed) window.history.replaceState(null, "", live.canonical);
  }, [ready, route.fixed, route.canonical, signedIn]);

  const write = useCallback((mode: "push" | "replace", view: View | null, id: string | null) => {
    const url = buildUrl(view, id);
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    // Keep the ref current until the next render, so two calls in one handler (go, then openCard) compose.
    latest.current = { ...latest.current, view, id, screen: view ?? (id ? "tree" : latest.current.screen) };
  }, []);

  /** Switch screen (closes any open sheet unless `keepId`). Same screen again is a no-op unless replacing. */
  const go = useCallback(
    (view: View, opts: { replace?: boolean; keepId?: boolean } = {}) => {
      const cur = latest.current;
      const id = opts.keepId ? cur.id : null;
      if (!opts.replace && cur.screen === view && cur.id === id) return;
      write(opts.replace ? "replace" : "push", view, id);
      if (!opts.replace && (view === "auth" || view === "edit")) pushed.current.add(view);
    },
    [write],
  );

  /** Logout: back to the plain `/` (landing), replacing the current entry. */
  const home = useCallback(() => {
    window.history.replaceState(null, "", "/");
    latest.current = { ...latest.current, view: null, id: null, screen: "landing" };
  }, []);

  /** Guest "Home": open the landing as a new entry, so Back returns to the screen they came from. */
  const landing = useCallback(() => {
    if (latest.current.screen === "landing") return;
    window.history.pushState(null, "", "/");
    latest.current = { ...latest.current, view: null, id: null, screen: "landing" };
  }, []);

  /** Leave the Auth / Edit screen: pop the entry we pushed, or replace if the user arrived by link/refresh. */
  const back = useCallback(
    (from: "auth" | "edit", fallback: View | null) => {
      if (pushed.current.delete(from)) window.history.back();
      else write("replace", fallback, null);
    },
    [write],
  );

  /** Open the sheet for an ID: push when none is open (Back closes it), replace when jumping ID -> ID. */
  const openCard = useCallback(
    (id: string) => {
      const cur = latest.current;
      if (cur.id === id) return;
      if (cur.id) {
        write("replace", cur.view, id);
      } else {
        write("push", cur.view, id);
        pushed.current.add("sheet");
      }
    },
    [write],
  );

  /** Close the sheet, ending on the same view without `id` and without a dead-end history entry. */
  const closeCard = useCallback(() => {
    const cur = latest.current;
    if (!cur.id) return;
    if (pushed.current.delete("sheet")) window.history.back();
    else write("replace", cur.view, null);
  }, [write]);

  return { screen: route.screen, openId: route.id, go, home, landing, back, openCard, closeCard };
}
