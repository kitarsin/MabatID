"use client";

import { useSyncExternalStore } from "react";

/**
 * Weekly likes: one like per device per week (weeks start Monday, local time). The device remembers the
 * week it liked in localStorage; the shared count lives behind /api/likes (contract below — the endpoint
 * is owned by the backend, not this file).
 *
 *   GET  /api/likes  → 200 { week: "YYYY-MM-DD", count: number }      count for the current week
 *   POST /api/likes  → 200 { week, count }                              like recorded
 *                    → 409 { week, count }                              already liked this week
 */
export interface LikeTally {
  week: string;
  count: number;
}

const KEY = "mabatid.like.week";
const EVENT = "mabatid:like";

/** Monday of the current week as YYYY-MM-DD (local time). */
export function weekStart(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function weekKey(now = new Date()): string {
  const d = weekStart(now);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The Monday when this device can like again. */
export function nextWeekStart(now = new Date()): Date {
  const d = weekStart(now);
  d.setDate(d.getDate() + 7);
  return d;
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Whether this device already liked during the current week. */
export function useLikedThisWeek(): boolean {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  return stored === weekKey();
}

export function setLikedThisWeek(liked: boolean) {
  try {
    if (liked) localStorage.setItem(KEY, weekKey());
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode): the like still counts server-side */
  }
  window.dispatchEvent(new Event(EVENT));
}

function isTally(value: unknown): value is LikeTally {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as LikeTally).count === "number" &&
    typeof (value as LikeTally).week === "string"
  );
}

export async function fetchLikes(signal?: AbortSignal): Promise<LikeTally> {
  const res = await fetch("/api/likes", { cache: "no-store", signal });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok || !isTally(body)) throw new Error("likes unavailable");
  return body;
}

/** Records a like. `already` is true when the server says this device liked this week already. */
export async function sendLike(): Promise<LikeTally & { already: boolean }> {
  const res = await fetch("/api/likes", { method: "POST", cache: "no-store" });
  const body: unknown = await res.json().catch(() => null);
  if ((res.ok || res.status === 409) && isTally(body))
    return { ...body, already: res.status === 409 };
  throw new Error("like failed");
}
